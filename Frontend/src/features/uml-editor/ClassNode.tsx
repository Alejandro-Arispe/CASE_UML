import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { UmlClass } from '../../types/uml';
import { IconKey } from '../../components/ui/icons';

export interface ClassNodeData extends Record<string, unknown> {
  klass: UmlClass;
  // Estereotipo UML mostrado sobre el nombre (ej. «clase asociacion»).
  stereotype?: string;
}

// Puntos para arrastrar una relacion nueva, en los 4 lados (visibles al
// pasar el mouse). Con ConnectionMode.Loose cualquiera sirve de origen o
// destino; la linea en si se dibuja "flotante" hacia el borde mas cercano
// (ver UmlEdge), asi que el lado elegido no condiciona el dibujo.
const HANDLE_CLASS =
  '!h-2.5 !w-2.5 !border-2 !border-white !bg-indigo-600 !shadow-sm opacity-0 transition-opacity group-hover:opacity-100';
const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
];

// Caja de clase UML de 3 compartimentos (nombre / atributos / operaciones)
// con la notacion de Enterprise Architect: "- nombre: Tipo", la clave
// primaria con llave y subrayada, y [0..1] para lo opcional. El
// compartimento de operaciones queda vacio (el alcance es de base de datos),
// pero se dibuja para respetar la notacion.
function ClassNodeComponent({ data, selected }: { data: ClassNodeData; selected?: boolean }) {
  const { klass, stereotype } = data;

  return (
    <div
      className={`group min-w-[190px] max-w-[340px] rounded-[3px] border bg-white text-slate-900 shadow-[0_1px_3px_rgb(15_23_42/0.08)] transition-[border-color,box-shadow] duration-150 ${
        selected ? 'border-indigo-500 ring-[3px] ring-indigo-500/20' : 'border-slate-400 hover:border-slate-500'
      }`}
    >
      {SIDES.map((side) => (
        <Handle key={side.id} id={side.id} type="source" position={side.position} className={HANDLE_CLASS} />
      ))}

      <div
        className={`rounded-t-[2px] border-b px-3 pb-1.5 pt-1.5 text-center ${
          selected ? 'border-indigo-200 bg-indigo-50' : 'border-slate-300 bg-slate-100'
        }`}
      >
        {stereotype && <div className="text-[10px] leading-3 text-slate-600">«{stereotype}»</div>}
        <div className="truncate text-[13px] font-semibold leading-5" title={klass.name}>
          {klass.name}
        </div>
      </div>

      <ul className="min-h-[14px] py-1">
        {klass.attributes.map((attr) => (
          <li
            key={attr.id}
            className="grid grid-cols-[12px_minmax(0,1fr)] items-center gap-1.5 whitespace-nowrap px-2.5 text-[12px] leading-[18px]"
            title={`${attr.name}: ${attr.type}${attr.isPrimaryKey ? ' (clave primaria)' : attr.nullable ? ' (opcional)' : ''}`}
          >
            {attr.isPrimaryKey ? (
              <IconKey size={11} className="text-amber-600" strokeWidth={2.25} />
            ) : (
              <span className="text-center text-slate-400">-</span>
            )}
            <span className="min-w-0 truncate">
              <span className={attr.isPrimaryKey ? 'font-semibold underline decoration-slate-400 underline-offset-2' : ''}>
                {attr.name}
              </span>
              <span className="text-slate-500">: {attr.type}</span>
              {!attr.isPrimaryKey && attr.nullable && <span className="text-slate-400"> [0..1]</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="h-2.5 border-t border-slate-300" />
    </div>
  );
}

// Memo: con decenas de clases, arrastrar una no debe re-renderizar las demas.
export const ClassNode = memo(ClassNodeComponent);
