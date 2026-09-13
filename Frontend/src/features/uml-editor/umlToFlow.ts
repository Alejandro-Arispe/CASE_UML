import type { Edge, Node } from '@xyflow/react';
import type { UmlClass, UmlRelationship } from '../../types/uml';
import type { UmlEdgeData } from './UmlEdge';
import type { ClassNodeData } from './ClassNode';

// Conversion en un solo sentido: del modelo UML (fuente de verdad) hacia
// nodos/edges de React Flow (vista). Nunca al reves: los cambios del canvas
// se traducen a acciones del umlStore, no se lee el estado interno de Flow.

export function classToNode(klass: UmlClass, stereotype?: string): Node<ClassNodeData> {
  return {
    id: klass.id,
    type: 'umlClass',
    position: klass.position,
    data: { klass, stereotype },
  };
}

export function relationshipsToEdges(relationships: UmlRelationship[]): Edge<UmlEdgeData>[] {
  // Agrupa por par de clases (sin importar el sentido) para dibujar en
  // paralelo varias relaciones entre las mismas dos clases.
  const pairKey = (r: UmlRelationship) => [r.sourceClassId, r.targetClassId].sort().join('|');
  const groups = new Map<string, UmlRelationship[]>();
  for (const rel of relationships) {
    const key = pairKey(rel);
    groups.set(key, [...(groups.get(key) ?? []), rel]);
  }

  return relationships.map((rel) => {
    const group = groups.get(pairKey(rel))!;
    return {
      id: rel.id,
      source: rel.sourceClassId,
      target: rel.targetClassId,
      type: 'uml',
      data: {
        relationship: rel,
        parallelIndex: group.indexOf(rel),
        parallelCount: group.length,
        // El desplazamiento se calcula en un sentido canonico del par, para
        // que dos relaciones A->B y B->A no se desplacen hacia el mismo lado.
        parallelFlip: rel.sourceClassId > rel.targetClassId,
      },
    };
  });
}
