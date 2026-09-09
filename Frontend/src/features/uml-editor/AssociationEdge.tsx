import { BaseEdge, EdgeLabelRenderer, getStraightPath, Position } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { UmlRelationship } from '../../types/uml';

const LABEL_OFFSET = 14;

// Desplaza el punto de anclaje en la direccion en que el handle sale de la
// caja (perpendicular a su borde), nunca a lo largo de la diagonal hacia el
// otro extremo: si se moviera sobre la diagonal, un handle del lado derecho
// conectando hacia una clase que esta arriba-izquierda "retrocede" hacia
// adentro de su propia caja en vez de alejarse de ella, y la etiqueta queda
// tapada por el nodo.
function offsetFromBorder(x: number, y: number, position: Position | undefined) {
  switch (position) {
    case Position.Left:
      return { x: x - LABEL_OFFSET, y };
    case Position.Top:
      return { x, y: y - LABEL_OFFSET };
    case Position.Bottom:
      return { x, y: y + LABEL_OFFSET };
    case Position.Right:
    default:
      return { x: x + LABEL_OFFSET, y };
  }
}

// Asociacion UML 2.5: linea recta simple con la multiplicidad de cada
// extremo pegada a la clase correspondiente (no una etiqueta al medio),
// como se ve en Enterprise Architect. Las 4 relaciones que soporta el
// modelo (1:1, 1:N, N:1, N:M) se dibujan todas como asociacion simple.
export function AssociationEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const relationship = (data as { relationship?: UmlRelationship } | undefined)?.relationship;
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  const nearSource = offsetFromBorder(sourceX, sourceY, sourcePosition);
  const nearTarget = offsetFromBorder(targetX, targetY, targetPosition);

  return (
    <>
      <BaseEdge path={path} style={{ stroke: selected ? '#4f46e5' : '#1e293b', strokeWidth: selected ? 2 : 1 }} />
      {relationship && (
        <EdgeLabelRenderer>
          <div
            className="absolute rounded bg-white px-1 text-[10px] font-medium text-slate-700"
            style={{ transform: `translate(-50%, -50%) translate(${nearSource.x}px, ${nearSource.y}px)` }}
          >
            {relationship.sourceMultiplicity}
          </div>
          <div
            className="absolute rounded bg-white px-1 text-[10px] font-medium text-slate-700"
            style={{ transform: `translate(-50%, -50%) translate(${nearTarget.x}px, ${nearTarget.y}px)` }}
          >
            {relationship.targetMultiplicity}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
