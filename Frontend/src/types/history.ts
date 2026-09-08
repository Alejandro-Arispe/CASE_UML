export type EditElementType = 'CLASS' | 'ATTRIBUTE' | 'RELATIONSHIP';

export interface EditHistoryEntry {
  id: string;
  projectId: string;
  userId: string;
  operation: string;
  elementType: EditElementType;
  elementId: string;
  description: string;
  timestamp: string;
  revision: number;
}
