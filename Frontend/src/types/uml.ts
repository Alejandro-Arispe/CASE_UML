// Contrato del modelo UML compartido con el backend (ver dominio UMLModel).
// El editor visual (React Flow) es una vista de este modelo, no la fuente
// de verdad: la logica de validacion y generacion opera sobre estos tipos.

export const UML_DATA_TYPES = [
  'String',
  'Integer',
  'Long',
  'Double',
  'Boolean',
  'BigDecimal',
  'LocalDate',
  'LocalDateTime',
  'UUID',
] as const;

export type UmlDataType = (typeof UML_DATA_TYPES)[number];

export interface UmlAttribute {
  id: string;
  name: string;
  type: UmlDataType;
  isPrimaryKey: boolean;
  nullable: boolean;
  defaultValue?: string;
}

// - ASSOCIATION: asociacion simple.
// - AGGREGATION / COMPOSITION: target = TODO (rombo), source = PARTE.
// - GENERALIZATION: source = subclase, target = padre (triangulo).
export const RELATIONSHIP_KINDS = ['ASSOCIATION', 'AGGREGATION', 'COMPOSITION', 'GENERALIZATION'] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export const RELATIONSHIP_KIND_LABEL: Record<RelationshipKind, string> = {
  ASSOCIATION: 'Asociacion',
  AGGREGATION: 'Agregacion',
  COMPOSITION: 'Composicion',
  GENERALIZATION: 'Herencia',
};

export const MULTIPLICITIES = ['1', '0..1', '0..*', '1..*'] as const;
export type Multiplicity = (typeof MULTIPLICITIES)[number];

export function isManyMultiplicity(m: Multiplicity): boolean {
  return m === '0..*' || m === '1..*';
}

export interface UmlRelationship {
  id: string;
  sourceClassId: string;
  targetClassId: string;
  kind: RelationshipKind;
  sourceMultiplicity: Multiplicity;
  targetMultiplicity: Multiplicity;
  name?: string;
  associationClassId?: string;
}

export interface UmlClass {
  id: string;
  name: string;
  position: { x: number; y: number };
  attributes: UmlAttribute[];
}

export interface UmlModel {
  id: string;
  projectId: string;
  classes: UmlClass[];
  relationships: UmlRelationship[];
  revision: number;
}

// Multiplicidades por defecto al dibujar cada tipo de relacion (mismas que
// usa Enterprise Architect al trazar el conector de la parte al todo).
export const DEFAULT_MULTIPLICITIES: Record<RelationshipKind, { source: Multiplicity; target: Multiplicity }> = {
  ASSOCIATION: { source: '1', target: '0..*' },
  AGGREGATION: { source: '0..*', target: '1' },
  COMPOSITION: { source: '1..*', target: '1' },
  GENERALIZATION: { source: '1', target: '1' },
};
