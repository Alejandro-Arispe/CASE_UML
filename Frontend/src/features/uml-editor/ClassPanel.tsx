import { UML_DATA_TYPES } from '../../types/uml';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';

export function ClassPanel({ classId }: { classId: string }) {
  const klass = useUmlStore((state) => state.classes.find((c) => c.id === classId));

  if (!klass) return null;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Clase</p>
        <Input
          value={klass.name}
          onChange={(e) => collaboration.renameClass(klass.id, e.target.value)}
          className="mt-1 w-full font-medium"
        />
      </div>

      <div className="flex-1 space-y-3 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Atributos ({klass.attributes.length})
        </p>

        {klass.attributes.map((attr) => (
          <div key={attr.id} className="rounded-md border border-slate-200 p-2.5">
            <div className="flex gap-2">
              <Input
                aria-label="nombre del atributo"
                value={attr.name}
                onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { name: e.target.value })}
                className="flex-1"
              />
              <Select
                aria-label="tipo del atributo"
                value={attr.type}
                onChange={(e) =>
                  collaboration.updateAttribute(klass.id, attr.id, { type: e.target.value as typeof attr.type })
                }
                className="w-28"
              >
                {UML_DATA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={attr.isPrimaryKey}
                    onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { isPrimaryKey: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  PK
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={attr.nullable}
                    onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { nullable: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Nullable
                </label>
              </div>
              <button
                type="button"
                onClick={() => collaboration.removeAttribute(klass.id, attr.id)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <Button type="button" size="sm" onClick={() => collaboration.addAttribute(klass.id)} className="w-full">
          + Atributo
        </Button>
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <Button variant="danger" size="sm" onClick={() => collaboration.deleteClass(klass.id)} className="w-full">
          Eliminar clase
        </Button>
      </div>
    </aside>
  );
}
