import { EditHistory } from '../../domain/entities';

export interface EditHistoryRepository {
  add(entry: EditHistory): Promise<void>;
  addMany(entries: EditHistory[]): Promise<void>;
  findRecentByProject(projectId: string, limit?: number): Promise<EditHistory[]>;
}
