import { EditElementType, RelationshipKind, UmlModel } from '../../../domain/entities';
import { UmlOperationInput } from './umlOperations';

const KIND_LABEL: Record<RelationshipKind, string> = {
  ASSOCIATION: 'asociacion',
  AGGREGATION: 'agregacion',
  COMPOSITION: 'composicion',
  GENERALIZATION: 'herencia',
};

function className(model: UmlModel, classId: string): string {
  return model.classes.find((c) => c.id === classId)?.name ?? '?';
}

function attributeName(model: UmlModel, classId: string, attributeId: string): string {
  const klass = model.classes.find((c) => c.id === classId);
  return klass?.attributes.find((a) => a.id === attributeId)?.name ?? '?';
}

function relationshipLabel(model: UmlModel, relationshipId: string): string {
  const rel = model.relationships.find((r) => r.id === relationshipId);
  if (!rel) return '';
  return `${KIND_LABEL[rel.kind]} ${className(model, rel.sourceClassId)} - ${className(model, rel.targetClassId)}`;
}

// Traduce una operacion aplicada a la descripcion legible del historial
// (seccion 27), ej. "Agrego telefono a Cliente". `before` es el modelo
// previo a aplicar la operacion (necesario para describir borrados, donde
// el elemento ya no existe en `after`); `after` es el resultado.
export function describeUmlOperation(
  op: UmlOperationInput,
  before: UmlModel,
  after: UmlModel,
): { elementType: EditElementType; elementId: string; description: string } {
  switch (op.operation) {
    case 'CREATE_CLASS':
      return { elementType: 'CLASS', elementId: op.classId, description: `Creo la clase ${op.name}` };

    case 'RENAME_CLASS':
      return {
        elementType: 'CLASS',
        elementId: op.classId,
        description: `Renombro ${className(before, op.classId)} a ${op.name}`,
      };

    case 'MOVE_ELEMENT':
      return {
        elementType: 'CLASS',
        elementId: op.classId,
        description: `Movio la clase ${className(after, op.classId)}`,
      };

    case 'DELETE_CLASS':
      return {
        elementType: 'CLASS',
        elementId: op.classId,
        description: `Elimino la clase ${className(before, op.classId)}`,
      };

    case 'ADD_ATTRIBUTE':
      return {
        elementType: 'ATTRIBUTE',
        elementId: op.attributeId,
        description: `Agrego ${op.name} a ${className(after, op.classId)}`,
      };

    case 'UPDATE_ATTRIBUTE':
      return {
        elementType: 'ATTRIBUTE',
        elementId: op.attributeId,
        description: `Actualizo ${op.name ?? attributeName(before, op.classId, op.attributeId)} en ${className(before, op.classId)}`,
      };

    case 'REMOVE_ATTRIBUTE':
      return {
        elementType: 'ATTRIBUTE',
        elementId: op.attributeId,
        description: `Elimino ${attributeName(before, op.classId, op.attributeId)} de ${className(before, op.classId)}`,
      };

    case 'CREATE_RELATIONSHIP':
      return {
        elementType: 'RELATIONSHIP',
        elementId: op.relationshipId,
        description: `Creo ${KIND_LABEL[op.kind]} ${className(after, op.sourceClassId)} - ${className(after, op.targetClassId)}`,
      };

    case 'UPDATE_RELATIONSHIP':
    case 'SET_MULTIPLICITY':
      return {
        elementType: 'RELATIONSHIP',
        elementId: op.relationshipId,
        description: `Actualizo la ${relationshipLabel(after, op.relationshipId)}`,
      };

    case 'DELETE_RELATIONSHIP':
      return {
        elementType: 'RELATIONSHIP',
        elementId: op.relationshipId,
        description: `Elimino la ${relationshipLabel(before, op.relationshipId)}`,
      };
  }
}
