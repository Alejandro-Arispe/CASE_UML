import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useUmlStore } from '../../store/umlStore';
import { RELATIONSHIP_KIND_LABEL } from '../../types/uml';
import { IconChevronRight, IconClass, IconSearch, IconX, RelationGlyph } from '../../components/ui/icons';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <IconChevronRight size={14} className={`text-slate-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        {title}
        <span className="ml-auto rounded bg-slate-100 px-1.5 text-[11px] font-medium tabular-nums text-slate-600">{count}</span>
      </button>
      {open && <ul className="pb-2">{children}</ul>}
    </section>
  );
}

// Explorador del modelo (equivalente al "Project Browser" de Enterprise
// Architect): lista navegable de clases y relaciones. Seleccionar un item lo
// selecciona en el diagrama y centra la vista en el.
export function ModelExplorer({
  onFocusClass,
}: {
  onFocusClass: (classId: string, options?: { select?: boolean }) => void;
}) {
  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);
  const selectedClassId = useUmlStore((state) => state.selectedClassId);
  const selectedRelationshipId = useUmlStore((state) => state.selectedRelationshipId);
  const selectRelationship = useUmlStore((state) => state.selectRelationship);
  const [query, setQuery] = useState('');

  const nameById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const parentById = useMemo(
    () => new Map(relationships.filter((r) => r.kind === 'GENERALIZATION').map((r) => [r.sourceClassId, r.targetClassId])),
    [relationships],
  );

  const q = normalize(query.trim());
  const visibleClasses = [...classes]
    .filter((c) => !q || normalize(c.name).includes(q) || c.attributes.some((a) => normalize(a.name).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const visibleRelationships = relationships.filter((r) => {
    if (!q) return true;
    const text = `${nameById.get(r.sourceClassId)} ${nameById.get(r.targetClassId)} ${r.name ?? ''} ${RELATIONSHIP_KIND_LABEL[r.kind]}`;
    return normalize(text).includes(q);
  });

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white" aria-label="Explorador del modelo">
      <div className="flex h-10 shrink-0 items-center border-b border-slate-100 px-3">
        <h2 className="text-[13px] font-semibold text-slate-900">Explorador</h2>
      </div>

      <div className="border-b border-slate-100 p-2">
        <label className="relative block">
          <span className="sr-only">Buscar en el modelo</span>
          <IconSearch size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clase, atributo..."
            className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-7 text-[13px] text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar busqueda"
              className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
            >
              <IconX size={12} />
            </button>
          )}
        </label>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <Section title="Clases" count={visibleClasses.length}>
          {visibleClasses.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">{classes.length ? 'Sin resultados' : 'Todavia no hay clases'}</li>
          )}
          {visibleClasses.map((klass) => {
            const selected = klass.id === selectedClassId;
            const parent = parentById.get(klass.id);
            return (
              <li key={klass.id}>
                <button
                  type="button"
                  onClick={() => onFocusClass(klass.id)}
                  className={`flex w-full items-center gap-2 py-1 pl-7 pr-2 text-left text-[13px] ${
                    selected ? 'bg-indigo-50 text-indigo-800' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <IconClass size={14} className={selected ? 'text-indigo-600' : 'text-slate-500'} />
                  <span className="min-w-0 truncate">
                    {klass.name}
                    {parent && <span className="text-slate-500"> : {nameById.get(parent)}</span>}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-slate-500" title="Atributos">
                    {klass.attributes.length}
                  </span>
                </button>
              </li>
            );
          })}
        </Section>

        <Section title="Relaciones" count={visibleRelationships.length}>
          {visibleRelationships.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">{relationships.length ? 'Sin resultados' : 'Todavia no hay relaciones'}</li>
          )}
          {visibleRelationships.map((rel) => {
            const selected = rel.id === selectedRelationshipId;
            return (
              <li key={rel.id}>
                <button
                  type="button"
                  onClick={() => {
                    onFocusClass(rel.targetClassId, { select: false });
                    selectRelationship(rel.id);
                  }}
                  title={`${RELATIONSHIP_KIND_LABEL[rel.kind]}${rel.name ? ` "${rel.name}"` : ''}`}
                  className={`flex w-full items-center gap-2 py-1 pl-7 pr-2 text-left text-[13px] ${
                    selected ? 'bg-indigo-50 text-indigo-800 [--glyph-fill:var(--color-indigo-50)]' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <RelationGlyph kind={rel.kind} className={selected ? 'text-indigo-600' : 'text-slate-600'} />
                  <span className="min-w-0 truncate">
                    {nameById.get(rel.sourceClassId)}
                    <span className="text-slate-400"> → </span>
                    {nameById.get(rel.targetClassId)}
                  </span>
                </button>
              </li>
            );
          })}
        </Section>
      </div>
    </aside>
  );
}
