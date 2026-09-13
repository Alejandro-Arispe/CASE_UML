import { useUmlStore } from '../../store/umlStore';
import { RELATIONSHIP_KIND_LABEL } from '../../types/uml';
import { IconClass, RelationGlyph } from '../../components/ui/icons';
import { ClassPanel } from './ClassPanel';
import { RelationshipPanel } from './RelationshipPanel';
import { PanelSection } from './PanelSection';

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Clic derecho', action: 'Menu del canvas, clase o relacion' },
  { keys: 'Arrastrar borde', action: 'Crear relacion del tipo elegido' },
  { keys: 'Shift + clic', action: 'Seleccion multiple para alinear' },
  { keys: 'Supr', action: 'Eliminar lo seleccionado' },
  { keys: 'Enter / Esc', action: 'Confirmar o cancelar un nombre' },
];

// Resumen del modelo cuando no hay nada seleccionado: evita un panel vacio y
// anticipa lo que "Validar" va a marcar (clases sin clave primaria).
function ModelOverview() {
  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);

  const subclassIds = new Set(relationships.filter((r) => r.kind === 'GENERALIZATION').map((r) => r.sourceClassId));
  const withoutPk = classes.filter((c) => !subclassIds.has(c.id) && !c.attributes.some((a) => a.isPrimaryKey));
  const attributeCount = classes.reduce((sum, c) => sum + c.attributes.length, 0);

  const stats = [
    { label: 'Clases', value: classes.length },
    { label: 'Atributos', value: attributeCount },
    { label: 'Relaciones', value: relationships.length },
  ];

  return (
    <>
      <PanelSection title="Modelo">
        <dl className="grid grid-cols-3 divide-x divide-slate-100 rounded-md border border-slate-200">
          {stats.map((stat) => (
            <div key={stat.label} className="px-2 py-2 text-center">
              <dt className="text-[11px] text-slate-600">{stat.label}</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">{stat.value}</dd>
            </div>
          ))}
        </dl>
        {withoutPk.length > 0 && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            {withoutPk.length === 1 ? 'Una clase no tiene' : `${withoutPk.length} clases no tienen`} clave primaria:{' '}
            {withoutPk.map((c) => c.name).join(', ')}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-600">Selecciona una clase o relacion para editar sus propiedades.</p>
      </PanelSection>

      <PanelSection title="Atajos">
        <ul className="space-y-1.5">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600">{shortcut.action}</span>
              <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] text-slate-700">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </PanelSection>
    </>
  );
}

// Inspector de propiedades fijo a la derecha (como en Enterprise Architect):
// siempre ocupa su lugar, asi el canvas no cambia de tamano al seleccionar.
export function PropertiesPanel({ multiSelectionCount }: { multiSelectionCount: number }) {
  const selectedClassId = useUmlStore((state) => state.selectedClassId);
  const selectedRelationshipId = useUmlStore((state) => state.selectedRelationshipId);
  const klass = useUmlStore((state) => state.classes.find((c) => c.id === selectedClassId));
  const relationship = useUmlStore((state) => state.relationships.find((r) => r.id === selectedRelationshipId));

  let subtitle = null;
  if (multiSelectionCount > 1) {
    subtitle = <span className="text-slate-600">{multiSelectionCount} clases seleccionadas</span>;
  } else if (klass) {
    subtitle = (
      <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
        <IconClass size={14} className="shrink-0 text-indigo-600" />
        <span className="truncate">Clase · {klass.name}</span>
      </span>
    );
  } else if (relationship) {
    subtitle = (
      <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
        <RelationGlyph kind={relationship.kind} className="text-indigo-600" />
        <span className="truncate">{RELATIONSHIP_KIND_LABEL[relationship.kind]}</span>
      </span>
    );
  }

  return (
    <aside className="flex w-[22rem] shrink-0 flex-col border-l border-slate-200 bg-white" aria-label="Propiedades">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-slate-100 px-3">
        <h2 className="text-[13px] font-semibold text-slate-900">Propiedades</h2>
        {subtitle && <span className="ml-auto flex min-w-0 text-xs">{subtitle}</span>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {multiSelectionCount > 1 ? (
          <PanelSection title="Seleccion multiple">
            <p className="text-xs text-slate-600">
              Usa la barra sobre el diagrama para alinear o distribuir las clases, o presiona Supr para eliminarlas.
            </p>
          </PanelSection>
        ) : klass ? (
          <ClassPanel key={klass.id} classId={klass.id} />
        ) : relationship ? (
          <RelationshipPanel key={relationship.id} relationshipId={relationship.id} />
        ) : (
          <ModelOverview />
        )}
      </div>
    </aside>
  );
}
