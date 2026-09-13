export interface ValidationIssue {
  code: string;
  // ERROR bloquea la generacion; WARNING solo informa.
  severity: 'ERROR' | 'WARNING';
  elementType: 'CLASS' | 'ATTRIBUTE' | 'RELATIONSHIP';
  elementId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
