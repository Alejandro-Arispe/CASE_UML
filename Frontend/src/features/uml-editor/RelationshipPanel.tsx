import {
  DEFAULT_MULTIPLICITIES,
  isManyMultiplicity,
  MULTIPLICITIES,
  RELATIONSHIP_KIND_LABEL,
  RELATIONSHIP_KINDS,
} from '../../types/uml';
import type { Multiplicity, RelationshipKind, UmlRelationship } from '../../types/uml';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { CommitInput } from '../../components/ui/CommitInput';
import { Select } from '../../components/ui/Input';
import { IconSwap, IconTrash, RelationGlyph } from '../../components/ui/icons';
import { PanelSection } from './PanelSection';

const MULTIPLICITY_HINT: Record<Multiplicity, string> = {
  '1': 'exactamente uno',
  '0..1': 'cero o uno',
  '0..*': 'cero o muchos',
  '1..*': 'uno o muchos',
};

// Explica en lenguaje de base de datos que va a generar la relacion (mismas
// reglas que Backend/src/generator/planGeneration.ts), para que el usuario
// entienda el efecto de cada tipo y multiplicidad antes de generar.
function describeGeneration(rel: UmlRelationship, sourceName: string, targetName: string, associationName?: string): string {
  if (rel.kind === 'GENERALIZATION') {
    return `${sourceName} hereda de ${targetName}: tendra su propia tabla que comparte la clave primaria de ${targetName}.`;
  }
  if (associationName) {
    return `${associationName} tendra claves foraneas obligatorias hacia ${sourceName} y ${targetName} (una fila por cada vinculo).`;
  }
  const sourceMany = isManyMultiplicity(rel.sourceMultiplicity);
  const targetMany = isManyMultiplicity(rel.targetMultiplicity);
  const optional = (m: Multiplicity) => (m === '0..1' || m === '0..*' ? 'opcional' : 'obligatoria');

  if (sourceMany && targetMany) {
    return `Muchos a muchos: se crea una tabla intermedia entre ${sourceName} y ${targetName}.`;
  }
  if (!sourceMany && targetMany) {
    return `${targetName} tendra la clave foranea hacia ${sourceName} (${optional(rel.sourceMultiplicity)}).`;
  }
  if (sourceMany && !targetMany) {
    const cascade = rel.kind === 'COMPOSITION' ? ` Al borrar un ${targetName} se borran sus ${sourceName}.` : '';
    return `${sourceName} tendra la clave foranea hacia ${targetName} (${optional(rel.targetMultiplicity)}).${cascade}`;
  }
  if (rel.kind === 'AGGREGATION' || rel.kind === 'COMPOSITION') {
    return `Uno a uno: ${sourceName} tendra una clave foranea UNICA hacia ${targetName}.`;
  }
  if (rel.targetMultiplicity === '1' && rel.sourceMultiplicity === '0..1') {
    return `Uno a uno: ${sourceName} tendra una clave foranea UNICA y obligatoria hacia ${targetName}.`;
  }
  return `Uno a uno: ${targetName} tendra una clave foranea UNICA hacia ${sourceName} (${optional(rel.sourceMultiplicity)}).`;
}

export function RelationshipPanel({ relationshipId }: { relationshipId: string }) {
  const relationship = useUmlStore((state) => state.relationships.find((r) => r.id === relationshipId));
  const classes = useUmlStore((state) => state.classes);
  const selectClass = useUmlStore((state) => state.selectClass);

  if (!relationship) return null;

  const nameOf = (id: string | undefined) => classes.find((c) => c.id === id)?.name ?? '?';
  const sourceName = nameOf(relationship.sourceClassId);
  const targetName = nameOf(relationship.targetClassId);
  const isGeneralization = relationship.kind === 'GENERALIZATION';
  const isWholePart = relationship.kind === 'AGGREGATION' || relationship.kind === 'COMPOSITION';
  const associationName = relationship.associationClassId ? nameOf(relationship.associationClassId) : undefined;

  const endRole = (end: 'source' | 'target') => {
    if (isGeneralization) return end === 'source' ? 'Subclase' : 'Padre';
    if (isWholePart) return end === 'source' ? 'Parte' : 'Todo';
    return end === 'source' ? 'Origen' : 'Destino';
  };

  function changeKind(kind: RelationshipKind) {
    if (kind === relationship!.kind) return;
    // Al pasar de/a herencia las multiplicidades anteriores no tienen
    // sentido: se usan las por defecto del nuevo tipo.
    const resetMultiplicities = kind === 'GENERALIZATION' || relationship!.kind === 'GENERALIZATION';
    collaboration.updateRelationship({
      relationshipId: relationship!.id,
      kind,
      ...(resetMultiplicities
        ? { sourceMultiplicity: DEFAULT_MULTIPLICITIES[kind].source, targetMultiplicity: DEFAULT_MULTIPLICITIES[kind].target }
        : {}),
    });
  }

  const ends: { end: 'source' | 'target'; classId: string; name: string; multiplicity: Multiplicity }[] = [
    { end: 'source', classId: relationship.sourceClassId, name: sourceName, multiplicity: relationship.sourceMultiplicity },
    { end: 'target', classId: relationship.targetClassId, name: targetName, multiplicity: relationship.targetMultiplicity },
  ];

  return (
    <>
      <PanelSection title="Tipo de relacion">
        <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Tipo de relacion">
          {RELATIONSHIP_KINDS.map((kind) => {
            const active = relationship.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => changeKind(kind)}
                className={`flex h-8 items-center gap-2 rounded-md border px-2 text-[13px] transition-colors ${
                  active
                    ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-800 [--glyph-fill:var(--color-indigo-50)]'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <RelationGlyph kind={kind} className={active ? 'text-indigo-600' : 'text-slate-600'} />
                {RELATIONSHIP_KIND_LABEL[kind]}
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection
        title="Extremos"
        action={
          <button
            type="button"
            onClick={() => collaboration.reverseRelationship(relationship)}
            className="flex h-6 items-center gap-1 rounded px-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            title="Intercambiar origen y destino"
          >
            <IconSwap size={14} />
            Invertir
          </button>
        }
      >
        <div className="space-y-1.5">
          {ends.map(({ end, classId, name, multiplicity }) => (
            <div key={end} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2">
              <span className="text-xs text-slate-600">{endRole(end)}</span>
              <button
                type="button"
                onClick={() => selectClass(classId)}
                className="truncate text-left text-[13px] font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                title={`Ir a ${name}`}
              >
                {name}
              </button>
              {!isGeneralization && (
                <Select
                  fieldSize="sm"
                  aria-label={`Multiplicidad en ${name}`}
                  title={MULTIPLICITY_HINT[multiplicity]}
                  value={multiplicity}
                  onChange={(e) =>
                    collaboration.updateRelationship({
                      relationshipId: relationship.id,
                      [end === 'source' ? 'sourceMultiplicity' : 'targetMultiplicity']: e.target.value as Multiplicity,
                    })
                  }
                  className="w-20 font-mono"
                >
                  {MULTIPLICITIES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ))}
        </div>
        {!isGeneralization && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            La multiplicidad de cada extremo indica cuantas instancias de esa clase participan.
          </p>
        )}
      </PanelSection>

      {!isGeneralization && (
        <PanelSection title="Detalles">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-600">Nombre o rol (opcional)</span>
            <CommitInput
              fieldSize="sm"
              value={relationship.name ?? ''}
              allowEmpty
              placeholder="ej. comprador"
              onCommit={(name) => collaboration.updateRelationship({ relationshipId: relationship.id, name })}
              className="w-full"
            />
          </label>

          {relationship.kind === 'ASSOCIATION' && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-slate-600">Clase asociacion</span>
              <Select
                fieldSize="sm"
                value={relationship.associationClassId ?? ''}
                onChange={(e) =>
                  collaboration.updateRelationship({ relationshipId: relationship.id, associationClassId: e.target.value || null })
                }
                className="w-full"
              >
                <option value="">Ninguna</option>
                {classes
                  .filter((c) => c.id !== relationship.sourceClassId && c.id !== relationship.targetClassId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </label>
          )}
        </PanelSection>
      )}

      <PanelSection title="En la base de datos">
        <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-700">
          {describeGeneration(relationship, sourceName, targetName, associationName)}
        </p>
      </PanelSection>

      <div className="px-3 py-3">
        <button
          type="button"
          onClick={() => collaboration.deleteRelationship(relationship.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 text-[13px] font-medium text-red-700 transition-colors hover:border-red-200 hover:bg-red-50"
        >
          <IconTrash size={14} />
          Eliminar relacion
        </button>
      </div>
    </>
  );
}
