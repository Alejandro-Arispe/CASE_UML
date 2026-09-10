import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';

// "Organizar diagrama": reacomoda automaticamente las clases con Dagre
// (layout de grafos dirigidos por capas). Se eligio Dagre sobre ELK.js por
// ser mucho mas liviano (una sola dependencia sin web worker) y suficiente
// para el tamaño tipico de un diagrama de clase de un parcial -- ELK da
// mejor ruteo de aristas pero para reposicionar cajas rectangulares en
// capas el resultado es equivalente y no justifica el peso extra.
const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 120;

export function computeDagreLayout(nodes: Node[], edges: Edge[]): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 110, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.measured?.width ?? DEFAULT_WIDTH,
      height: node.measured?.height ?? DEFAULT_HEIGHT,
    });
  }
  for (const edge of edges) {
    if (edge.source === edge.target) continue; // dagre no maneja bien auto-ciclos
    graph.setEdge(edge.source, edge.target);
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
