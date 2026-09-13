import dagre from 'dagre';
import type { Node } from '@xyflow/react';
import type { UmlRelationship } from '../../types/uml';

// "Organizar diagrama": reacomoda automaticamente las clases con Dagre
// (layout de grafos dirigidos por capas). Se eligio Dagre sobre ELK.js por
// ser mucho mas liviano y suficiente para reposicionar cajas rectangulares.
const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 120;

export function computeDagreLayout(nodes: Node[], relationships: UmlRelationship[]): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 70, ranksep: 110, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.measured?.width ?? DEFAULT_WIDTH,
      height: node.measured?.height ?? DEFAULT_HEIGHT,
    });
  }
  for (const rel of relationships) {
    if (rel.sourceClassId === rel.targetClassId) continue; // dagre no maneja bien auto-ciclos
    // Como en un diagrama de clases dibujado a mano: el padre arriba de sus
    // subclases y el "todo" arriba de sus partes.
    if (rel.kind === 'ASSOCIATION') graph.setEdge(rel.sourceClassId, rel.targetClassId);
    else graph.setEdge(rel.targetClassId, rel.sourceClassId);
    if (rel.associationClassId) graph.setEdge(rel.sourceClassId, rel.associationClassId);
  }

  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const layouted = graph.node(node.id);
    if (!layouted) continue;
    const width = node.measured?.width ?? DEFAULT_WIDTH;
    const height = node.measured?.height ?? DEFAULT_HEIGHT;
    // Dagre posiciona por el centro del nodo; React Flow por la esquina
    // superior izquierda.
    positions.set(node.id, { x: layouted.x - width / 2, y: layouted.y - height / 2 });
  }
  return positions;
}
