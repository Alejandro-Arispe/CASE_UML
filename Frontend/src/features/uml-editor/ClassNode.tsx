import { Handle, Position } from '@xyflow/react';
import type { UmlClass } from '../../types/uml';

interface ClassNodeProps {
  data: { klass: UmlClass };
  selected?: boolean;
}

const HANDLE_STYLE = { width: 8, height: 8, background: '#1e293b', border: '1px solid white' };

// Caja de clase UML 2.5 de 3 compartimentos (nombre / atributos /
// operaciones), con el mismo aspecto que usa por defecto Enterprise
// Architect: bordes rectos y finos, sin sombra, "+ nombre : Tipo" con la
// clave primaria subrayada y la multiplicidad [0..1] para lo opcional.
// El compartimento de operaciones queda vacio (el modelo no las modela
// todavia), pero se muestra igual para respetar la notacion.
export function ClassNode({ data, selected }: ClassNodeProps) {
  const { klass } = data;

  return (
    <div
      className={`min-w-[200px] max-w-[320px] border bg-white text-xs text-slate-900 ${
        selected ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-800'
      }`}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />

      <div
        className="truncate border-b border-slate-800 px-3 py-1.5 text-center text-sm font-bold"
        title={klass.name}
      >
        {klass.name}
      </div>

      <ul className="min-h-[6px] border-b border-slate-800 py-1">
        {klass.attributes.map((attr) => (
          <li
            key={attr.id}
            className="flex items-baseline gap-1 px-2 py-0.5 leading-tight"
            title={`${attr.name}: ${attr.type}${attr.nullable ? ' [0..1]' : ''}`}
          >
            <span className="shrink-0 text-slate-500">+</span>
            <span className="min-w-0 truncate">
              <span className={attr.isPrimaryKey ? 'underline decoration-1 underline-offset-2' : ''}>
                {attr.name}
              </span>
              <span className="text-slate-500">: {attr.type}</span>
              {attr.nullable && <span className="text-slate-400"> [0..1]</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="min-h-[10px]" />
    </div>
  );
}
