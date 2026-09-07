import { PrismaClient } from '@prisma/client';
import { ProjectMember } from '../../domain/entities';
import { ProjectMemberRepository, ProjectMemberWithUser } from '../../ports/out/ProjectMemberRepository';

export class PrismaProjectMemberRepository implements ProjectMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByProjectId(projectId: string): Promise<ProjectMember[]> {
    return this.prisma.projectMember.findMany({ where: { projectId } });
  }

  async findByProjectIdWithUser(projectId: string): Promise<ProjectMemberWithUser[]> {
    const records = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return records.map(({ user, ...member }) => ({
      ...member,
      userName: user.name,
      userEmail: user.email,
    }));
  }

  findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async save(member: ProjectMember): Promise<void> {
    await this.prisma.projectMember.upsert({
      where: { id: member.id },
      create: member,
      update: member,
    });
  }
}
