import { useReactFlow } from '@xyflow/react';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { Button } from '../../components/ui/Button';

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

  function withBoxes(fn: (boxes: Box[]) => void) {
    fn(selectedIds.map(getBox));
  }

  const alignLeft = () =>
    withBoxes((boxes) => {
      const minX = Math.min(...boxes.map((b) => b.x));
      boxes.forEach((b) => collaboration.moveClass(b.id, { x: minX, y: b.y }));
    });

  const alignRight = () =>
    withBoxes((boxes) => {
      const maxRight = Math.max(...boxes.map((b) => b.x + b.width));
      boxes.forEach((b) => collaboration.moveClass(b.id, { x: maxRight - b.width, y: b.y }));
    });

  const alignTop = () =>
    withBoxes((boxes) => {
      const minY = Math.min(...boxes.map((b) => b.y));
      boxes.forEach((b) => collaboration.moveClass(b.id, { x: b.x, y: minY }));
    });

  const alignBottom = () =>
    withBoxes((boxes) => {
      const maxBottom = Math.max(...boxes.map((b) => b.y + b.height));
      boxes.forEach((b) => collaboration.moveClass(b.id, { x: b.x, y: maxBottom - b.height }));
    });

  const alignCenterH = () =>
    withBoxes((boxes) => {
      const centers = boxes.map((b) => b.x + b.width / 2);
      const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
      boxes.forEach((b) => collaboration.moveClass(b.id, { x: avg - b.width / 2, y: b.y }));
    });

  const alignCenterV = () =>
    withBoxes((boxes) => {
      const centers = boxes.map((b) => b.y + b.height / 2);
      const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
      boxes.forEach((b) => collaboration.moveClass(b.id, { x: b.x, y: avg - b.height / 2 }));
    });

  const distributeHorizontal = () =>
    withBoxes((boxesUnsorted) => {
      const boxes = [...boxesUnsorted].sort((a, b) => a.x - b.x);
      const first = boxes[0];
      const last = boxes[boxes.length - 1];
      const totalWidth = boxes.reduce((sum, b) => sum + b.width, 0);
      const gap = (last.x + last.width - first.x - totalWidth) / (boxes.length - 1);
      let cursor = first.x;
      boxes.forEach((b) => {
        collaboration.moveClass(b.id, { x: cursor, y: b.y });
        cursor += b.width + gap;
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
      boxes.forEach((b) => {
        collaboration.moveClass(b.id, { x: b.x, y: cursor });
        cursor += b.height + gap;
      });
    });

  const canDistribute = selectedIds.length >= 3;

  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
      <span className="pr-1 text-xs font-medium text-slate-400">{selectedIds.length} seleccionadas</span>
      <Button variant="ghost" size="sm" title="Alinear a la izquierda" onClick={alignLeft}>
        Izq
      </Button>
      <Button variant="ghost" size="sm" title="Alinear al centro (horizontal)" onClick={alignCenterH}>
        Centro H
      </Button>
      <Button variant="ghost" size="sm" title="Alinear a la derecha" onClick={alignRight}>
        Der
      </Button>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <Button variant="ghost" size="sm" title="Alinear arriba" onClick={alignTop}>
        Arriba
      </Button>
      <Button variant="ghost" size="sm" title="Alinear al centro (vertical)" onClick={alignCenterV}>
        Centro V
      </Button>
      <Button variant="ghost" size="sm" title="Alinear abajo" onClick={alignBottom}>
        Abajo
      </Button>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <Button
        variant="ghost"
        size="sm"
        title="Distribuir horizontalmente (necesita 3 o mas)"
        disabled={!canDistribute}
        onClick={distributeHorizontal}
      >
        Distrib. H
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title="Distribuir verticalmente (necesita 3 o mas)"
        disabled={!canDistribute}
        onClick={distributeVertical}
      >
        Distrib. V
      </Button>
    </div>
  );
}
