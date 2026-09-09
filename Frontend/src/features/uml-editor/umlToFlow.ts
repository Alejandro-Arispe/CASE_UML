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

export function relationshipToEdge(rel: UmlRelationship): Edge {
  return {
    id: rel.id,
    source: rel.sourceClassId,
    target: rel.targetClassId,
    type: 'association',
    data: { relationship: rel },
  };
}
