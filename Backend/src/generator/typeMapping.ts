import { UmlDataType } from '../domain/entities';

// Mapeo de tipos UML -> Java -> PostgreSQL (seccion 15). Cerrado: no
// agregar tipos hasta que la generacion realmente los necesite.
export const JAVA_TYPE: Record<UmlDataType, string> = {
  String: 'String',
  Integer: 'Integer',
  Long: 'Long',
  Double: 'Double',
  Boolean: 'Boolean',
  BigDecimal: 'BigDecimal',
  LocalDate: 'LocalDate',
  LocalDateTime: 'LocalDateTime',
  UUID: 'UUID',
};

export const SQL_TYPE: Record<UmlDataType, string> = {
  String: 'VARCHAR',
  Integer: 'INTEGER',
  Long: 'BIGINT',
  Double: 'DOUBLE PRECISION',
  Boolean: 'BOOLEAN',
  BigDecimal: 'NUMERIC',
  LocalDate: 'DATE',
  LocalDateTime: 'TIMESTAMP',
  UUID: 'UUID',
};

// Import Java necesario para el tipo (los tipos primitivos-wrapper de
// java.lang no necesitan import explicito).
export const JAVA_IMPORT: Partial<Record<UmlDataType, string>> = {
  BigDecimal: 'java.math.BigDecimal',
  LocalDate: 'java.time.LocalDate',
  LocalDateTime: 'java.time.LocalDateTime',
  UUID: 'java.util.UUID',
};
