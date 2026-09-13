import { RELATIONSHIP_KIND_LABEL, UML_DATA_TYPES } from '../../types/uml';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { CommitInput } from '../../components/ui/CommitInput';
import { Select } from '../../components/ui/Input';
import { IconKey, IconPlus, IconTrash, RelationGlyph } from '../../components/ui/icons';
import { PanelSection } from './PanelSection';

export function ClassPanel({ classId }: { classId: string }) {
  const klass = useUmlStore((state) => state.classes.find((c) => c.id === classId));
  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);
  const selectRelationship = useUmlStore((state) => state.selectRelationship);

  if (!klass) return null;

  const nameOf = (id: string) => classes.find((c) => c.id === id)?.name ?? '?';
  const parent = relationships.find((r) => r.kind === 'GENERALIZATION' && r.sourceClassId === klass.id);
  const related = relationships.filter(
    (r) => r.sourceClassId === klass.id || r.targetClassId === klass.id || r.associationClassId === klass.id,
  );
  const hasPrimaryKey = klass.attributes.some((a) => a.isPrimaryKey);

  return (
    <>
      <PanelSection title="General">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Nombre</span>
          <CommitInput
            fieldSize="sm"
            value={klass.name}
            onCommit={(name) => collaboration.renameClass(klass.id, name)}
            className="w-full font-medium"
          />
        </label>
        {parent ? (
          <p className="mt-2 text-xs text-slate-600">
            Hereda de <span className="font-medium text-slate-800">{nameOf(parent.targetClassId)}</span> y usa su clave primaria.
          </p>
        ) : (
          !hasPrimaryKey &&
          klass.attributes.length > 0 && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
              Sin clave primaria: marca un atributo con la llave para poder generar el backend.
            </p>
          )
        )}
      </PanelSection>

      <PanelSection
        title={`Atributos (${klass.attributes.length})`}
        action={
          <button
            type="button"
            onClick={() => collaboration.addAttribute(klass.id)}
            className="flex h-6 items-center gap-1 rounded px-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            <IconPlus size={14} />
            Agregar
          </button>
        }
      >
        {klass.attributes.length === 0 ? (
          <button
            type="button"
            onClick={() => collaboration.addAttribute(klass.id)}
            className="w-full rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700"
          >
            Esta clase no tiene atributos. Agrega el primero.
          </button>
        ) : (
          <div role="table" aria-label="Atributos de la clase" className="-mx-1">
            <div role="row" className="grid grid-cols-[24px_minmax(0,1fr)_122px_28px_24px] items-center gap-1 px-1 pb-1 text-[11px] text-slate-500">
              <span role="columnheader" title="Clave primaria">PK</span>
              <span role="columnheader">Nombre</span>
              <span role="columnheader">Tipo</span>
              <span role="columnheader" title="Admite nulo">Nulo</span>
              <span role="columnheader" className="sr-only">Eliminar</span>
            </div>
            {klass.attributes.map((attr) => (
              <div
                key={attr.id}
                role="row"
                className="group grid grid-cols-[24px_minmax(0,1fr)_122px_28px_24px] items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-50"
              >
                <button
                  type="button"
                  role="cell"
                  aria-pressed={attr.isPrimaryKey}
                  aria-label={attr.isPrimaryKey ? `Quitar ${attr.name} como clave primaria` : `Marcar ${attr.name} como clave primaria`}
                  onClick={() =>
                    collaboration.updateAttribute(klass.id, attr.id, {
                      isPrimaryKey: !attr.isPrimaryKey,
                      ...(!attr.isPrimaryKey ? { nullable: false } : {}),
                    })
                  }
                  className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                    attr.isPrimaryKey ? 'bg-amber-100 text-amber-700' : 'text-slate-300 hover:bg-slate-200 hover:text-slate-600'
                  }`}
                >
                  <IconKey size={14} />
                </button>
                <CommitInput
                  role="cell"
                  fieldSize="sm"
                  aria-label="nombre del atributo"
                  value={attr.name}
                  onCommit={(name) => collaboration.updateAttribute(klass.id, attr.id, { name })}
                  className={`w-full ${attr.isPrimaryKey ? 'font-medium' : ''}`}
                />
                <Select
                  role="cell"
                  fieldSize="sm"
                  aria-label="tipo del atributo"
                  value={attr.type}
                  onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { type: e.target.value as typeof attr.type })}
                  className="w-full"
                >
                  {UML_DATA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
                <span role="cell" className="flex justify-center">
                  <input
                    type="checkbox"
                    aria-label="admite nulo"
                    checked={attr.nullable}
                    disabled={attr.isPrimaryKey}
                    onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { nullable: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600 disabled:opacity-40"
                  />
                </span>
                <button
                  type="button"
                  role="cell"
                  aria-label={`Eliminar ${attr.name}`}
                  onClick={() => collaboration.removeAttribute(klass.id, attr.id)}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-60 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {related.length > 0 && (
        <PanelSection title={`Relaciones (${related.length})`}>
          <ul className="-mx-1 space-y-0.5">
            {related.map((rel) => (
              <li key={rel.id}>
                <button
                  type="button"
                  onClick={() => selectRelationship(rel.id)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
                  title={RELATIONSHIP_KIND_LABEL[rel.kind]}
                >
                  <RelationGlyph kind={rel.kind} className="text-slate-600" />
                  <span className="min-w-0 truncate">
                    {nameOf(rel.sourceClassId)} <span className="text-slate-400">→</span> {nameOf(rel.targetClassId)}
                    {rel.associationClassId === klass.id && <span className="text-slate-500"> (clase asociacion)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      <div className="px-3 py-3">
        <button
          type="button"
          onClick={() => collaboration.deleteClass(klass.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 text-[13px] font-medium text-red-700 transition-colors hover:border-red-200 hover:bg-red-50"
        >
          <IconTrash size={14} />
          Eliminar clase
        </button>
      </div>
    </>
  );
}
