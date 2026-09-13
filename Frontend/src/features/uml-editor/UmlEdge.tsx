import { BaseEdge, EdgeLabelRenderer, useInternalNode } from '@xyflow/react';
import type { EdgeProps, InternalNode } from '@xyflow/react';
import type { UmlRelationship } from '../../types/uml';

export interface UmlEdgeData extends Record<string, unknown> {
  relationship: UmlRelationship;
  // Posicion de esta relacion entre las que unen el mismo par de clases,
  // para separarlas en paralelo en vez de dibujarlas encimadas.
  parallelIndex: number;
  parallelCount: number;
  parallelFlip: boolean;
}

interface Point {
  x: number;
  y: number;
}

const STROKE = '#475569';
const STROKE_SELECTED = '#4f46e5';
const PARALLEL_GAP = 22;
const MARKER_LENGTH = { diamond: 20, triangle: 15 };

function nodeBox(node: InternalNode) {
  const width = node.measured.width ?? 200;
  const height = node.measured.height ?? 100;
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

// Punto donde la recta entre el centro de `node` y `towards` corta el borde
// del rectangulo del nodo ("floating edge", como Enterprise Architect: la
// linea sale del lado mas cercano en vez de un conector fijo).
function borderIntersection(node: InternalNode, towards: Point, shift: Point = { x: 0, y: 0 }): Point {
  const box = nodeBox(node);
  const cx = box.cx + shift.x;
  const cy = box.cy + shift.y;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(
    dx !== 0 ? box.width / 2 / Math.abs(dx) : Infinity,
    dy !== 0 ? box.height / 2 / Math.abs(dy) : Infinity,
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function unit(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function add(p: Point, v: Point, k = 1): Point {
  return { x: p.x + v.x * k, y: p.y + v.y * k };
}

function polygon(points: Point[]): string {
  return `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
}

// Halo del color del canvas alrededor del texto: la etiqueta se lee sobre la
// linea o la grilla sin tapar el diagrama con una caja blanca.
const LABEL_HALO = '0 0 2px #f5f6f8, 0 0 2px #f5f6f8, 0 0 3px #f5f6f8, 0 0 4px #f5f6f8';

function Label({ at, children, className = '' }: { at: Point; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`nodrag nopan pointer-events-none absolute whitespace-nowrap font-mono text-[11px] leading-none text-slate-700 ${className}`}
      style={{ transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)`, textShadow: LABEL_HALO }}
    >
      {children}
    </div>
  );
}

// Relacion UML con notacion de Enterprise Architect:
// - Asociacion: linea simple.
// - Agregacion: rombo vacio en el TODO (target).
// - Composicion: rombo relleno en el TODO (target).
// - Herencia: triangulo vacio en el PADRE (target), sin multiplicidades.
// - Clase asociacion: linea punteada desde el medio de la relacion.
export function UmlEdge({ id, source, target, data, selected }: EdgeProps) {
  const { relationship, parallelIndex = 0, parallelCount = 1, parallelFlip = false } = (data ?? {}) as Partial<UmlEdgeData>;
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const associationNode = useInternalNode(relationship?.associationClassId ?? '');

  if (!sourceNode || !targetNode || !relationship) return null;

  const stroke = selected ? STROKE_SELECTED : STROKE;
  const strokeWidth = selected ? 1.75 : 1.25;
  const isGeneralization = relationship.kind === 'GENERALIZATION';

  let path: string;
  let markerPath: string | null = null;
  let markerFill = '#ffffff';
  let sourceLabelAt: Point;
  let targetLabelAt: Point;
  let middle: Point;

  if (source === target) {
    // Autorrelacion: lazo sobre el borde derecho (arriba suelen llegar otras
    // lineas y las etiquetas se encimarian).
    const box = nodeBox(sourceNode);
    const offset = parallelIndex * 16;
    const right = box.x + box.width;
    const start = { x: right, y: box.y + 14 + offset };
    const outTop = { x: right + 40 + offset, y: start.y };
    const outBottom = { x: outTop.x, y: box.y + 54 + offset * 2 };
    const end = { x: right, y: outBottom.y };
    path = `M ${start.x},${start.y} L ${outTop.x},${outTop.y} L ${outBottom.x},${outBottom.y} L ${end.x},${end.y}`;
    sourceLabelAt = { x: right + 16, y: start.y - 9 };
    targetLabelAt = { x: right + 16, y: end.y + 9 };
    middle = { x: outTop.x, y: (outTop.y + outBottom.y) / 2 };
  } else {
    const sourceBox = nodeBox(sourceNode);
    const targetBox = nodeBox(targetNode);
    const direction = unit({ x: sourceBox.cx, y: sourceBox.cy }, { x: targetBox.cx, y: targetBox.cy });
    const normal = { x: -direction.y, y: direction.x };
    const shiftAmount = (parallelIndex - (parallelCount - 1) / 2) * PARALLEL_GAP * (parallelFlip ? -1 : 1);
    const shift = { x: normal.x * shiftAmount, y: normal.y * shiftAmount };

    const start = borderIntersection(sourceNode, add({ x: targetBox.cx, y: targetBox.cy }, shift), shift);
    const tip = borderIntersection(targetNode, add({ x: sourceBox.cx, y: sourceBox.cy }, shift), shift);
    const u = unit(start, tip);
    const n = { x: -u.y, y: u.x };

    let lineEnd = tip;
    if (isGeneralization) {
      const base = add(tip, u, -MARKER_LENGTH.triangle);
      markerPath = polygon([tip, add(base, n, 8), add(base, n, -8)]);
      lineEnd = base;
    } else if (relationship.kind === 'AGGREGATION' || relationship.kind === 'COMPOSITION') {
      const back = add(tip, u, -MARKER_LENGTH.diamond);
      const mid = add(tip, u, -MARKER_LENGTH.diamond / 2);
      markerPath = polygon([tip, add(mid, n, 6), back, add(mid, n, -6)]);
      markerFill = relationship.kind === 'COMPOSITION' ? stroke : '#ffffff';
      lineEnd = back;
    }

    path = `M ${start.x},${start.y} L ${lineEnd.x},${lineEnd.y}`;
    // Multiplicidades pegadas a cada extremo, del lado "de afuera" de la linea.
    sourceLabelAt = add(add(start, u, 16), n, 11);
    const targetInset = markerPath ? MARKER_LENGTH.diamond + 10 : 16;
    targetLabelAt = add(add(tip, u, -targetInset), n, 11);
    middle = { x: (start.x + tip.x) / 2, y: (start.y + tip.y) / 2 };
  }

  const associationLink =
    associationNode && relationship.associationClassId
      ? { from: middle, to: borderIntersection(associationNode, middle) }
      : null;

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth }} interactionWidth={14} />
      {markerPath && <path d={markerPath} fill={markerFill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />}
      {associationLink && (
        <path
          d={`M ${associationLink.from.x},${associationLink.from.y} L ${associationLink.to.x},${associationLink.to.y}`}
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="6 4"
        />
      )}
      <EdgeLabelRenderer>
        {!isGeneralization && (
          <>
            <Label at={sourceLabelAt}>{relationship.sourceMultiplicity}</Label>
            <Label at={targetLabelAt}>{relationship.targetMultiplicity}</Label>
          </>
        )}
        {relationship.name && (
          <Label at={add(middle, { x: 0, y: -12 })} className="font-sans text-[12px] font-medium italic text-slate-800">
            {relationship.name}
          </Label>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
