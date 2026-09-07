import { PrismaClient } from '@prisma/client';
import { Project } from '../../domain/entities';
import { ProjectRepository } from '../../ports/out/ProjectRepository';

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  findByInviteCode(inviteCode: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { inviteCode } });
  }

  findAllForUser(userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async save(project: Project): Promise<void> {
    await this.prisma.project.upsert({
      where: { id: project.id },
      create: project,
      update: project,
    });
  }

  async touch(id: string): Promise<void> {
    await this.prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
  }
}
