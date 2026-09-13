import {
  Multiplicity,
  RelationshipKind,
  UmlAttribute,
  UmlClass,
  UmlDataType,
  UmlModel,
  UmlRelationship,
} from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';

// Operaciones granulares de edicion (secciones 21/22/29). El cliente ya
// asigna los IDs (classId, attributeId, relationshipId) al crear un
// elemento: son UUIDs estables (seccion 14) generados en el momento en que
// el usuario interactua, necesarios para que todos los clientes converjan
// al mismo id sin una ronda de ida y vuelta previa al servidor.
export type UmlOperationInput =
  | { operation: 'CREATE_CLASS'; classId: string; name: string; position: { x: number; y: number } }
  | { operation: 'RENAME_CLASS'; classId: string; name: string }
  | { operation: 'MOVE_ELEMENT'; classId: string; position: { x: number; y: number } }
  | { operation: 'DELETE_CLASS'; classId: string }
  | {
      operation: 'ADD_ATTRIBUTE';
      classId: string;
      attributeId: string;
      name: string;
      type: UmlDataType;
      isPrimaryKey?: boolean;
      nullable?: boolean;
      defaultValue?: string;
    }
  | {
      operation: 'UPDATE_ATTRIBUTE';
      classId: string;
      attributeId: string;
      name?: string;
      type?: UmlDataType;
      isPrimaryKey?: boolean;
      nullable?: boolean;
      defaultValue?: string;
    }
  | { operation: 'REMOVE_ATTRIBUTE'; classId: string; attributeId: string }
  | {
      operation: 'CREATE_RELATIONSHIP';
      relationshipId: string;
      sourceClassId: string;
      targetClassId: string;
      kind: RelationshipKind;
      sourceMultiplicity: Multiplicity;
      targetMultiplicity: Multiplicity;
      name?: string;
      associationClassId?: string;
    }
  | {
      // Parche parcial: solo se modifican los campos presentes. `name: ""`
      // y `associationClassId: null` quitan el valor. Cambiar
      // source/target permite "invertir direccion" (ej. una herencia
      // dibujada al reves).
      operation: 'UPDATE_RELATIONSHIP';
      relationshipId: string;
      kind?: RelationshipKind;
      sourceClassId?: string;
      targetClassId?: string;
      sourceMultiplicity?: Multiplicity;
      targetMultiplicity?: Multiplicity;
      name?: string;
      associationClassId?: string | null;
    }
  | {
      operation: 'SET_MULTIPLICITY';
      relationshipId: string;
      sourceMultiplicity: Multiplicity;
      targetMultiplicity: Multiplicity;
    }
  | { operation: 'DELETE_RELATIONSHIP'; relationshipId: string };

// Nombre de evento que se difunde al room tras aplicar la operacion
// (seccion 21). Varias operaciones comparten evento de salida cuando
// afectan al mismo tipo de elemento de forma equivalente.
export const OPERATION_EVENT_NAME: Record<UmlOperationInput['operation'], string> = {
  CREATE_CLASS: 'class_created',
  RENAME_CLASS: 'class_updated',
  MOVE_ELEMENT: 'element_moved',
  DELETE_CLASS: 'class_deleted',
  ADD_ATTRIBUTE: 'attribute_created',
  UPDATE_ATTRIBUTE: 'attribute_updated',
  REMOVE_ATTRIBUTE: 'attribute_deleted',
  CREATE_RELATIONSHIP: 'relationship_created',
  UPDATE_RELATIONSHIP: 'relationship_updated',
  SET_MULTIPLICITY: 'relationship_updated',
  DELETE_RELATIONSHIP: 'relationship_deleted',
};

function getClassOrThrow(model: UmlModel, classId: string): UmlClass {
  const klass = model.classes.find((c) => c.id === classId);
  if (!klass) throw new DomainError('La clase no existe en el modelo actual');
  return klass;
}

function getRelationshipOrThrow(model: UmlModel, relationshipId: string): UmlRelationship {
  const rel = model.relationships.find((r) => r.id === relationshipId);
  if (!rel) throw new DomainError('La relacion no existe en el modelo actual');
  return rel;
}

function cleanName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed ? trimmed : undefined;
}

// Reglas que dependen de otras relaciones del modelo (no solo de la nueva):
// una herencia no puede ser de una clase consigo misma ni formar un ciclo, y
// una clase asociacion no puede ser uno de los extremos de su propia linea.
function assertRelationshipIsConsistent(model: UmlModel, rel: UmlRelationship) {
  getClassOrThrow(model, rel.sourceClassId);
  getClassOrThrow(model, rel.targetClassId);

  if (rel.kind === 'GENERALIZATION') {
    if (rel.sourceClassId === rel.targetClassId) {
      throw new DomainError('Una clase no puede heredar de si misma');
    }
    // Recorre los padres del destino: si se llega al origen, habria ciclo.
    const parentsOf = (classId: string) =>
      model.relationships
        .filter((r) => r.id !== rel.id && r.kind === 'GENERALIZATION' && r.sourceClassId === classId)
        .map((r) => r.targetClassId);
    const pending = [rel.targetClassId];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (current === rel.sourceClassId) throw new DomainError('La herencia formaria un ciclo');
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...parentsOf(current));
    }
  }

  if (rel.associationClassId) {
    if (rel.kind !== 'ASSOCIATION') {
      throw new DomainError('Solo una asociacion puede tener clase asociacion');
    }
    getClassOrThrow(model, rel.associationClassId);
    if (rel.associationClassId === rel.sourceClassId || rel.associationClassId === rel.targetClassId) {
      throw new DomainError('La clase asociacion no puede ser uno de los extremos de la relacion');
    }
  }
}

// Para reemplazos completos del grafo (importar XMI, guardado REST): mismas
// reglas que al crear relaciones una por una, mas IDs unicos, para no
// persistir referencias colgantes que la base rechazaria por FK.
export function assertModelIsConsistent(model: UmlModel) {
  const ids = new Set<string>();
  const claim = (id: string) => {
    if (ids.has(id)) throw new DomainError(`ID duplicado en el modelo: ${id}`);
    ids.add(id);
  };
  for (const klass of model.classes) {
    claim(klass.id);
    if (!klass.name.trim()) throw new DomainError('Hay una clase sin nombre');
    klass.attributes.forEach((a) => claim(a.id));
  }
  for (const rel of model.relationships) {
    claim(rel.id);
    assertRelationshipIsConsistent(model, rel);
  }
}

// Funcion pura: dado el modelo actual y una operacion valida, produce el
// modelo resultante. No persiste ni conoce revision; eso lo maneja el caso
// de uso que la invoca (ApplyUmlOperation).
export function applyOperationToModel(model: UmlModel, op: UmlOperationInput): UmlModel {
  switch (op.operation) {
    case 'CREATE_CLASS': {
      const name = op.name.trim();
      if (!name) throw new DomainError('La clase debe tener un nombre');
      if (model.classes.some((c) => c.id === op.classId)) throw new DomainError('Ya existe una clase con ese id');
      const klass: UmlClass = { id: op.classId, name, position: op.position, attributes: [] };
      return { ...model, classes: [...model.classes, klass] };
    }

    case 'RENAME_CLASS': {
      getClassOrThrow(model, op.classId);
      const name = op.name.trim();
      if (!name) throw new DomainError('La clase debe tener un nombre');
      return { ...model, classes: model.classes.map((c) => (c.id === op.classId ? { ...c, name } : c)) };
    }

    case 'MOVE_ELEMENT': {
      getClassOrThrow(model, op.classId);
      return {
        ...model,
        classes: model.classes.map((c) => (c.id === op.classId ? { ...c, position: op.position } : c)),
      };
    }

    case 'DELETE_CLASS': {
      getClassOrThrow(model, op.classId);
      return {
        ...model,
        classes: model.classes.filter((c) => c.id !== op.classId),
        relationships: model.relationships
          .filter((r) => r.sourceClassId !== op.classId && r.targetClassId !== op.classId)
          .map((r) => (r.associationClassId === op.classId ? { ...r, associationClassId: undefined } : r)),
      };
    }

    case 'ADD_ATTRIBUTE': {
      const klass = getClassOrThrow(model, op.classId);
      const name = op.name.trim();
      if (!name) throw new DomainError('El atributo debe tener un nombre');
      if (klass.attributes.some((a) => a.id === op.attributeId)) throw new DomainError('Ya existe un atributo con ese id');
      const attribute: UmlAttribute = {
        id: op.attributeId,
        name,
        type: op.type,
        isPrimaryKey: op.isPrimaryKey ?? false,
        nullable: op.nullable ?? true,
        defaultValue: op.defaultValue,
      };
      return {
        ...model,
        classes: model.classes.map((c) =>
          c.id === op.classId ? { ...c, attributes: [...c.attributes, attribute] } : c,
        ),
      };
    }

    case 'UPDATE_ATTRIBUTE': {
      const klass = getClassOrThrow(model, op.classId);
      if (!klass.attributes.some((a) => a.id === op.attributeId)) {
        throw new DomainError('El atributo no existe en la clase');
      }
      if (op.name !== undefined && !op.name.trim()) {
        throw new DomainError('El atributo debe tener un nombre');
      }
      return {
        ...model,
        classes: model.classes.map((c) =>
          c.id === op.classId
            ? {
                ...c,
                attributes: c.attributes.map((a) =>
                  a.id === op.attributeId
                    ? {
                        ...a,
                        ...(op.name !== undefined ? { name: op.name.trim() } : {}),
                        ...(op.type !== undefined ? { type: op.type } : {}),
                        ...(op.isPrimaryKey !== undefined ? { isPrimaryKey: op.isPrimaryKey } : {}),
                        ...(op.nullable !== undefined ? { nullable: op.nullable } : {}),
                        ...(op.defaultValue !== undefined ? { defaultValue: op.defaultValue } : {}),
                      }
                    : a,
                ),
              }
            : c,
        ),
      };
    }

    case 'REMOVE_ATTRIBUTE': {
      getClassOrThrow(model, op.classId);
      return {
        ...model,
        classes: model.classes.map((c) =>
          c.id === op.classId ? { ...c, attributes: c.attributes.filter((a) => a.id !== op.attributeId) } : c,
        ),
      };
    }

    case 'CREATE_RELATIONSHIP': {
      if (model.relationships.some((r) => r.id === op.relationshipId)) {
        throw new DomainError('Ya existe una relacion con ese id');
      }
      const relationship: UmlRelationship = {
        id: op.relationshipId,
        sourceClassId: op.sourceClassId,
        targetClassId: op.targetClassId,
        kind: op.kind,
        sourceMultiplicity: op.sourceMultiplicity,
        targetMultiplicity: op.targetMultiplicity,
        name: cleanName(op.name),
        associationClassId: op.associationClassId || undefined,
      };
      assertRelationshipIsConsistent(model, relationship);
      return { ...model, relationships: [...model.relationships, relationship] };
    }

    case 'UPDATE_RELATIONSHIP': {
      const current = getRelationshipOrThrow(model, op.relationshipId);
      const updated: UmlRelationship = {
        ...current,
        ...(op.kind !== undefined ? { kind: op.kind } : {}),
        ...(op.sourceClassId !== undefined ? { sourceClassId: op.sourceClassId } : {}),
        ...(op.targetClassId !== undefined ? { targetClassId: op.targetClassId } : {}),
        ...(op.sourceMultiplicity !== undefined ? { sourceMultiplicity: op.sourceMultiplicity } : {}),
        ...(op.targetMultiplicity !== undefined ? { targetMultiplicity: op.targetMultiplicity } : {}),
        ...(op.name !== undefined ? { name: cleanName(op.name) } : {}),
        ...(op.associationClassId !== undefined ? { associationClassId: op.associationClassId || undefined } : {}),
      };
      // Pasar a un tipo que no admite clase asociacion la quita en vez de
      // rechazar el cambio (es lo que el usuario espera al cambiar el tipo).
      if (updated.kind !== 'ASSOCIATION') updated.associationClassId = undefined;
      assertRelationshipIsConsistent(model, updated);
      return {
        ...model,
        relationships: model.relationships.map((r) => (r.id === op.relationshipId ? updated : r)),
      };
    }

    case 'SET_MULTIPLICITY': {
      getRelationshipOrThrow(model, op.relationshipId);
      return {
        ...model,
        relationships: model.relationships.map((r) =>
          r.id === op.relationshipId
            ? { ...r, sourceMultiplicity: op.sourceMultiplicity, targetMultiplicity: op.targetMultiplicity }
            : r,
        ),
      };
    }

    case 'DELETE_RELATIONSHIP': {
      getRelationshipOrThrow(model, op.relationshipId);
      return { ...model, relationships: model.relationships.filter((r) => r.id !== op.relationshipId) };
    }
  }
}
