import { api } from './api';
import type { EditHistoryEntry } from '../types/history';

export function getProjectHistory(projectId: string, limit?: number) {
  return api
    .get<EditHistoryEntry[]>(`/projects/${projectId}/history`, { params: limit ? { limit } : undefined })
    .then((res) => res.data);
}
