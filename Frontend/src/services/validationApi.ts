import { api } from './api';
import type { ValidationResult } from '../types/validation';

export function validateProject(projectId: string) {
  return api.get<ValidationResult>(`/projects/${projectId}/validate`).then((res) => res.data);
}
