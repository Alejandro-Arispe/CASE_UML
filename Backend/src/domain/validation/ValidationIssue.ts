export type ValidationIssueCode =
  // Estructura del modelo (domain/validation/validateUmlModel.ts)
  | 'CLASS_WITHOUT_NAME'
  | 'DUPLICATE_CLASS_NAME'
  | 'ATTRIBUTE_WITHOUT_NAME'
  | 'ATTRIBUTE_WITHOUT_TYPE'
  | 'DUPLICATE_ATTRIBUTE_NAME'
  | 'RELATIONSHIP_TO_UNKNOWN_CLASS'
  | 'INVALID_MULTIPLICITY'
  | 'INVALID_RELATIONSHIP_KIND'
  | 'INVALID_ASSOCIATION_CLASS'
  | 'INHERITANCE_CYCLE'
  | 'MULTIPLE_INHERITANCE'
  | 'DUPLICATE_ID'
  // Reglas de generacion (generator/planGeneration.ts)
  | 'ENTITY_WITHOUT_PRIMARY_KEY'
  | 'COMPOSITE_PRIMARY_KEY'
  | 'SUBCLASS_PRIMARY_KEY_IGNORED'
  | 'RESERVED_JAVA_NAME'
  | 'FIELD_NAME_COLLISION'
  | 'COLUMN_NAME_COLLISION';

// ERROR bloquea la generacion; WARNING se informa pero permite generar.
export type ValidationSeverity = 'ERROR' | 'WARNING';

export interface ValidationIssue {
  code: ValidationIssueCode;
  severity: ValidationSeverity;
  elementType: 'CLASS' | 'ATTRIBUTE' | 'RELATIONSHIP';
  elementId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function toValidationResult(issues: ValidationIssue[]): ValidationResult {
  return { valid: !issues.some((i) => i.severity === 'ERROR'), issues };
}
