import type { Edge, Node } from '@xyflow/react';
import type { UmlClass, UmlRelationship } from '../../types/uml';

// Conversion en un solo sentido: del modelo UML (fuente de verdad) hacia
// nodos/edges de React Flow (vista). Nunca al reves: los cambios del canvas
// se traducen a acciones del umlStore, no se lee el estado interno de Flow.

export function classToNode(klass: UmlClass): Node {
  return {
    id: klass.id,
    type: 'umlClass',
    position: klass.position,
    data: { klass },
  };
}

const RELATIONSHIP_LABEL: Record<UmlRelationship['type'], string> = {
  ONE_TO_ONE: '1 a 1',
  ONE_TO_MANY: '1 a N',
  MANY_TO_ONE: 'N a 1',
  MANY_TO_MANY: 'N a M',
};

export function relationshipToEdge(rel: UmlRelationship): Edge {
  return {
    id: rel.id,
    source: rel.sourceClassId,
    target: rel.targetClassId,
    label: `${rel.sourceMultiplicity} · ${RELATIONSHIP_LABEL[rel.type]} · ${rel.targetMultiplicity}`,
    data: { relationship: rel },
  };
}
