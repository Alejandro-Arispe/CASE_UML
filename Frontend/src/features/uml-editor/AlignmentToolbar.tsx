import { useReactFlow } from '@xyflow/react';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { ToolButton, ToolbarDivider } from '../../components/ui/IconButton';

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 100;

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Barra de alineacion/distribucion (herramientas de ingenieria, no
// decoracion): aparece cuando hay 2+ clases seleccionadas via la
// multi-seleccion nativa de React Flow (shift-click o arrastre de
// seleccion). Cada operacion recalcula posiciones y las emite con
// collaboration.moveClass, asi que quedan sincronizadas y persistidas como
// cualquier otro movimiento manual.
export function AlignmentToolbar({ selectedIds }: { selectedIds: string[] }) {
  const { getNode } = useReactFlow();
  const classes = useUmlStore((state) => state.classes);

  if (selectedIds.length < 2) return null;

  function getBox(id: string): Box {
    const klass = classes.find((c) => c.id === id);
    const node = getNode(id);
    return {
      id,
      x: klass?.position.x ?? node?.position.x ?? 0,
      y: klass?.position.y ?? node?.position.y ?? 0,
      width: node?.measured?.width ?? DEFAULT_WIDTH,
      height: node?.measured?.height ?? DEFAULT_HEIGHT,
    };
  }

  // Calcula la nueva posicion de cada caja y la envia como UN lote.
  function withBoxes(fn: (boxes: Box[]) => [string, { x: number; y: number }][]) {
    collaboration.moveClasses(new Map(fn(selectedIds.map(getBox))));
  }

  const alignLeft = () =>
    withBoxes((boxes) => {
      const minX = Math.min(...boxes.map((b) => b.x));
      return boxes.map((b) => [b.id, { x: minX, y: b.y }]);
    });

  const alignRight = () =>
    withBoxes((boxes) => {
      const maxRight = Math.max(...boxes.map((b) => b.x + b.width));
      return boxes.map((b) => [b.id, { x: maxRight - b.width, y: b.y }]);
    });

  const alignTop = () =>
    withBoxes((boxes) => {
      const minY = Math.min(...boxes.map((b) => b.y));
      return boxes.map((b) => [b.id, { x: b.x, y: minY }]);
    });

  const alignBottom = () =>
    withBoxes((boxes) => {
      const maxBottom = Math.max(...boxes.map((b) => b.y + b.height));
      return boxes.map((b) => [b.id, { x: b.x, y: maxBottom - b.height }]);
    });

  const alignCenterH = () =>
    withBoxes((boxes) => {
      const centers = boxes.map((b) => b.x + b.width / 2);
      const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
      return boxes.map((b) => [b.id, { x: avg - b.width / 2, y: b.y }]);
    });

  const alignCenterV = () =>
    withBoxes((boxes) => {
      const centers = boxes.map((b) => b.y + b.height / 2);
      const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
      return boxes.map((b) => [b.id, { x: b.x, y: avg - b.height / 2 }]);
    });

  const distributeHorizontal = () =>
    withBoxes((boxesUnsorted) => {
      const boxes = [...boxesUnsorted].sort((a, b) => a.x - b.x);
      const first = boxes[0];
      const last = boxes[boxes.length - 1];
      const totalWidth = boxes.reduce((sum, b) => sum + b.width, 0);
      const gap = (last.x + last.width - first.x - totalWidth) / (boxes.length - 1);
      let cursor = first.x;
      return boxes.map((b) => {
        const entry: [string, { x: number; y: number }] = [b.id, { x: cursor, y: b.y }];
        cursor += b.width + gap;
        return entry;
      });
    });

  const distributeVertical = () =>
    withBoxes((boxesUnsorted) => {
      const boxes = [...boxesUnsorted].sort((a, b) => a.y - b.y);
      const first = boxes[0];
      const last = boxes[boxes.length - 1];
      const totalHeight = boxes.reduce((sum, b) => sum + b.height, 0);
      const gap = (last.y + last.height - first.y - totalHeight) / (boxes.length - 1);
      let cursor = first.y;
      return boxes.map((b) => {
        const entry: [string, { x: number; y: number }] = [b.id, { x: b.x, y: cursor }];
        cursor += b.height + gap;
        return entry;
      });
    });

  const canDistribute = selectedIds.length >= 3;

  const glyph = (path: string) => (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      <span className="px-2 text-xs font-medium tabular-nums text-slate-700">{selectedIds.length} clases</span>
      <ToolbarDivider />
      <ToolButton label="Alinear a la izquierda" icon={glyph('M4 3v18M8 7h12M8 17h7')} onClick={alignLeft} />
      <ToolButton label="Centrar horizontalmente" icon={glyph('M12 3v18M6 7h12M8.5 17h7')} onClick={alignCenterH} />
      <ToolButton label="Alinear a la derecha" icon={glyph('M20 3v18M4 7h12M9 17h7')} onClick={alignRight} />
      <ToolbarDivider />
      <ToolButton label="Alinear arriba" icon={glyph('M3 4h18M7 8v12M17 8v7')} onClick={alignTop} />
      <ToolButton label="Centrar verticalmente" icon={glyph('M3 12h18M7 6v12M17 8.5v7')} onClick={alignCenterV} />
      <ToolButton label="Alinear abajo" icon={glyph('M3 20h18M7 4v12M17 9v7')} onClick={alignBottom} />
      <ToolbarDivider />
      <ToolButton
        label="Distribuir horizontalmente (3 o mas)"
        icon={glyph('M4 4v16M20 4v16M10 8v8M14 8v8')}
        disabled={!canDistribute}
        onClick={distributeHorizontal}
        tooltipAlign="end"
      />
      <ToolButton
        label="Distribuir verticalmente (3 o mas)"
        icon={glyph('M4 4h16M4 20h16M8 10h8M8 14h8')}
        disabled={!canDistribute}
        onClick={distributeVertical}
        tooltipAlign="end"
      />
    </div>
  );
}
