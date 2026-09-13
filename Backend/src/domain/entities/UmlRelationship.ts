import { randomUUID } from 'crypto';

// Relaciones de un diagrama de clases orientado a base de datos (seccion
// 12, ampliada para ser compatible con Enterprise Architect):
// - ASSOCIATION: asociacion simple con multiplicidad en cada extremo.
// - AGGREGATION / COMPOSITION: todo-parte. Convencion: `target` es el TODO
//   (donde se dibuja el rombo) y `source` es la PARTE, igual que EA cuando
//   se traza el conector de la parte hacia el todo.
// - GENERALIZATION: herencia. `source` es la subclase y `target` el padre
//   (donde se dibuja el triangulo). Las multiplicidades se ignoran.
export const RELATIONSHIP_KINDS = ['ASSOCIATION', 'AGGREGATION', 'COMPOSITION', 'GENERALIZATION'] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

// Multiplicidades soportadas (las que tienen traduccion directa a FK/JPA).
// "*" y "0..n" se normalizan a "0..*" al importar.
export const MULTIPLICITIES = ['1', '0..1', '0..*', '1..*'] as const;
export type Multiplicity = (typeof MULTIPLICITIES)[number];

export function isManyMultiplicity(m: Multiplicity): boolean {
  return m === '0..*' || m === '1..*';
}

export function isOptionalMultiplicity(m: Multiplicity): boolean {
  return m === '0..1' || m === '0..*';
}

export interface UmlRelationship {
  id: string;
  sourceClassId: string;
  targetClassId: string;
  kind: RelationshipKind;
  // Multiplicidad en el extremo de cada clase: "Aula (1) -- (0..*) Curso"
  // significa que un Aula tiene 0..* Cursos y cada Curso pertenece a 1 Aula.
  sourceMultiplicity: Multiplicity;
  targetMultiplicity: Multiplicity;
  // Nombre/rol opcional: se muestra en el diagrama y, en el generador, da
  // nombre al campo cuando hay mas de una relacion entre las mismas clases.
  name?: string;
  // Clase asociacion (solo para ASSOCIATION): la clase que "cuelga" de la
  // linea con un conector punteado, ej. Inscripcion entre Estudiante y Curso.
  associationClassId?: string;
}

export function createUmlRelationship(params: Omit<UmlRelationship, 'id'>): UmlRelationship {
  return {
    id: randomUUID(),
    ...params,
  };
}
