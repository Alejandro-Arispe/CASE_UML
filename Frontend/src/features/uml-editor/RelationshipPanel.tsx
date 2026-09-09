import type { Multiplicity, RelationshipType } from '../../types/uml';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { Button } from '../../components/ui/Button';
import { Label, Select } from '../../components/ui/Input';

const RELATIONSHIP_TYPES: RelationshipType[] = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'];
const MULTIPLICITIES: Multiplicity[] = ['1', 'N'];

export function RelationshipPanel({ relationshipId }: { relationshipId: string }) {
  const relationship = useUmlStore((state) => state.relationships.find((r) => r.id === relationshipId));
  const classes = useUmlStore((state) => state.classes);

  if (!relationship) return null;

  const sourceName = classes.find((c) => c.id === relationship.sourceClassId)?.name ?? '?';
  const targetName = classes.find((c) => c.id === relationship.targetClassId)?.name ?? '?';

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Relacion</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
          {sourceName}
          <span className="text-slate-300">&rarr;</span>
          {targetName}
        </p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-3">
        <div>
          <Label htmlFor="rel-type">Tipo</Label>
          <Select
            id="rel-type"
            value={relationship.type}
            onChange={(e) => collaboration.updateRelationshipType(relationship.id, e.target.value as RelationshipType)}
            className="w-full"
          >
            {RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="rel-source-mult">Multiplicidad origen</Label>
            <Select
              id="rel-source-mult"
              value={relationship.sourceMultiplicity}
              onChange={(e) =>
                collaboration.setMultiplicity(
                  relationship.id,
                  e.target.value as Multiplicity,
                  relationship.targetMultiplicity,
                )
              }
              className="w-full"
            >
              {MULTIPLICITIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex-1">
            <Label htmlFor="rel-target-mult">Multiplicidad destino</Label>
            <Select
              id="rel-target-mult"
              value={relationship.targetMultiplicity}
              onChange={(e) =>
                collaboration.setMultiplicity(
                  relationship.id,
                  relationship.sourceMultiplicity,
                  e.target.value as Multiplicity,
                )
              }
              className="w-full"
            >
              {MULTIPLICITIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <Button variant="danger" size="sm" onClick={() => collaboration.deleteRelationship(relationship.id)} className="w-full">
          Eliminar relacion
        </Button>
      </div>
    </aside>
  );
}
