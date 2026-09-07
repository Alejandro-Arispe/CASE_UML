import { randomUUID } from 'crypto';
import { DomainError } from '../errors/DomainError';

// Tipos soportados en esta etapa (seccion 15). Ampliar solo cuando sea
// necesario para la generacion; cada tipo debe tener mapeo a Java y SQL.
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

export function createUmlAttribute(params: {
  name: string;
  type: UmlDataType;
  isPrimaryKey?: boolean;
  nullable?: boolean;
  defaultValue?: string;
}): UmlAttribute {
  const name = params.name.trim();

  if (!name) {
    throw new DomainError('El atributo debe tener un nombre');
  }
  if (!UML_DATA_TYPES.includes(params.type)) {
    throw new DomainError(`Tipo de dato no soportado: ${params.type}`);
  }

  return {
    id: randomUUID(),
    name,
    type: params.type,
    isPrimaryKey: params.isPrimaryKey ?? false,
    nullable: params.nullable ?? true,
    defaultValue: params.defaultValue,
  };
}
