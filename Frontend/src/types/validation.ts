export interface ValidationIssue {
  code: string;
  elementType: 'CLASS' | 'ATTRIBUTE' | 'RELATIONSHIP';
  elementId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
