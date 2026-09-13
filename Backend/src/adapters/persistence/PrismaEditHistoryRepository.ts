import { PrismaClient } from '@prisma/client';
import { EditHistory } from '../../domain/entities';
import { EditHistoryRepository } from '../../ports/out/EditHistoryRepository';

export class PrismaEditHistoryRepository implements EditHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(entry: EditHistory): Promise<void> {
    await this.prisma.editHistory.create({ data: entry });
  }

  async addMany(entries: EditHistory[]): Promise<void> {
    if (entries.length === 0) return;
    await this.prisma.editHistory.createMany({ data: entries });
  }

  findRecentByProject(projectId: string, limit = 50): Promise<EditHistory[]> {
    return this.prisma.editHistory.findMany({
      where: { projectId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
