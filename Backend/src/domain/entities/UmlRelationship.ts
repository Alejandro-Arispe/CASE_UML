import { randomUUID } from 'crypto';

// Alcance de relaciones prioritarias (seccion 12): asociaciones con
// multiplicidad, traducibles directamente a JPA/FK. Aggregation,
// Composition y Dependency quedan fuera del MVP (seccion 13).
export type RelationshipType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';

export type Multiplicity = '1' | 'N';

export interface UmlRelationship {
  id: string;
  sourceClassId: string;
  targetClassId: string;
  type: RelationshipType;
  sourceMultiplicity: Multiplicity;
  targetMultiplicity: Multiplicity;
}

export function createUmlRelationship(params: {
  sourceClassId: string;
  targetClassId: string;
  type: RelationshipType;
  sourceMultiplicity: Multiplicity;
  targetMultiplicity: Multiplicity;
}): UmlRelationship {
  return {
    id: randomUUID(),
    ...params,
  };
}
