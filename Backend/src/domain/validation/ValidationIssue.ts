export type ValidationIssueCode =
  | 'CLASS_WITHOUT_NAME'
  | 'DUPLICATE_CLASS_NAME'
  | 'ATTRIBUTE_WITHOUT_NAME'
  | 'ATTRIBUTE_WITHOUT_TYPE'
  | 'ENTITY_WITHOUT_PRIMARY_KEY'
  | 'RELATIONSHIP_TO_UNKNOWN_CLASS'
  | 'INVALID_MULTIPLICITY'
  | 'DUPLICATE_ID';

export interface ValidationIssue {
  code: ValidationIssueCode;
  elementType: 'CLASS' | 'ATTRIBUTE' | 'RELATIONSHIP';
  elementId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
