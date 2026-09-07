import type { Multiplicity, RelationshipType } from '../../types/uml';
import { useUmlStore } from '../../store/umlStore';

const RELATIONSHIP_TYPES: RelationshipType[] = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'];
const MULTIPLICITIES: Multiplicity[] = ['1', 'N'];

export function RelationshipPanel({ relationshipId }: { relationshipId: string }) {
  const relationship = useUmlStore((state) => state.relationships.find((r) => r.id === relationshipId));
  const classes = useUmlStore((state) => state.classes);
  const updateRelationship = useUmlStore((state) => state.updateRelationship);
  const removeRelationship = useUmlStore((state) => state.removeRelationship);

  if (!relationship) return null;

  const sourceName = classes.find((c) => c.id === relationship.sourceClassId)?.name ?? '?';
  const targetName = classes.find((c) => c.id === relationship.targetClassId)?.name ?? '?';

  return (
    <aside>
      <h3>Relacion</h3>
      <p>
        {sourceName} → {targetName}
      </p>

      <label htmlFor="rel-type">Tipo</label>
      <select
        id="rel-type"
        value={relationship.type}
        onChange={(e) => updateRelationship(relationship.id, { type: e.target.value as RelationshipType })}
      >
        {RELATIONSHIP_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <label htmlFor="rel-source-mult">Multiplicidad origen</label>
      <select
        id="rel-source-mult"
        value={relationship.sourceMultiplicity}
        onChange={(e) =>
          updateRelationship(relationship.id, { sourceMultiplicity: e.target.value as Multiplicity })
        }
      >
        {MULTIPLICITIES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <label htmlFor="rel-target-mult">Multiplicidad destino</label>
      <select
        id="rel-target-mult"
        value={relationship.targetMultiplicity}
        onChange={(e) =>
          updateRelationship(relationship.id, { targetMultiplicity: e.target.value as Multiplicity })
        }
      >
        {MULTIPLICITIES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <hr />
      <button type="button" onClick={() => removeRelationship(relationship.id)}>
        Eliminar relacion
      </button>
    </aside>
  );
}
