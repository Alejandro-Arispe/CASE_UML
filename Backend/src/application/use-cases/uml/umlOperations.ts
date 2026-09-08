import {
  Multiplicity,
  RelationshipType,
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
      type: RelationshipType;
      sourceMultiplicity: Multiplicity;
      targetMultiplicity: Multiplicity;
    }
  | { operation: 'UPDATE_RELATIONSHIP'; relationshipId: string; type: RelationshipType }
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

// Funcion pura: dado el modelo actual y una operacion valida, produce el
// modelo resultante. No persiste ni conoce revision; eso lo maneja el caso
// de uso que la invoca (ApplyUmlOperation).
export function applyOperationToModel(model: UmlModel, op: UmlOperationInput): UmlModel {
  switch (op.operation) {
    case 'CREATE_CLASS': {
      const name = op.name.trim();
      if (!name) throw new DomainError('La clase debe tener un nombre');
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
        relationships: model.relationships.filter(
          (r) => r.sourceClassId !== op.classId && r.targetClassId !== op.classId,
        ),
      };
    }

    case 'ADD_ATTRIBUTE': {
      getClassOrThrow(model, op.classId);
      const name = op.name.trim();
      if (!name) throw new DomainError('El atributo debe tener un nombre');
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
      getClassOrThrow(model, op.sourceClassId);
      getClassOrThrow(model, op.targetClassId);
      const relationship: UmlRelationship = {
        id: op.relationshipId,
        sourceClassId: op.sourceClassId,
        targetClassId: op.targetClassId,
        type: op.type,
        sourceMultiplicity: op.sourceMultiplicity,
        targetMultiplicity: op.targetMultiplicity,
      };
      return { ...model, relationships: [...model.relationships, relationship] };
    }

    case 'UPDATE_RELATIONSHIP': {
      getRelationshipOrThrow(model, op.relationshipId);
      return {
        ...model,
        relationships: model.relationships.map((r) =>
          r.id === op.relationshipId ? { ...r, type: op.type } : r,
        ),
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
