// Contrato del modelo UML compartido con el backend (ver dominio UMLModel).
// El editor visual (React Flow) es una vista de este modelo, no la fuente
// de verdad: la logica de validacion y generacion opera sobre estos tipos.

export type UmlDataType =
  | 'String'
  | 'Integer'
  | 'Long'
  | 'Double'
  | 'Boolean'
  | 'BigDecimal'
  | 'LocalDate'
  | 'LocalDateTime'
  | 'UUID';

export interface UmlAttribute {
  id: string;
  name: string;
  type: UmlDataType;
  isPrimaryKey: boolean;
  nullable: boolean;
  defaultValue?: string;
}

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
