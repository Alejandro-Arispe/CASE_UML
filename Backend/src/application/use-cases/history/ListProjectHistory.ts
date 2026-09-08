import { EditHistory } from '../../../domain/entities';
import { EditHistoryRepository } from '../../../ports/out/EditHistoryRepository';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { ForbiddenError } from '../../errors';

export class ListProjectHistory {
  constructor(
    private readonly history: EditHistoryRepository,
    private readonly members: ProjectMemberRepository,
  ) {}

  async execute(input: { projectId: string; userId: string; limit?: number }): Promise<EditHistory[]> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    return this.history.findRecentByProject(input.projectId, input.limit);
  }
}
