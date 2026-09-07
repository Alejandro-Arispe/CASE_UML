import { Project } from '../../../domain/entities';
import { ProjectMemberRepository, ProjectMemberWithUser } from '../../../ports/out/ProjectMemberRepository';
import { ProjectRepository } from '../../../ports/out/ProjectRepository';
import { ForbiddenError, NotFoundError } from '../../errors';

export class GetProjectDetail {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly members: ProjectMemberRepository,
  ) {}

  async execute(input: { projectId: string; userId: string }): Promise<{
    project: Project;
    members: ProjectMemberWithUser[];
  }> {
    const project = await this.projects.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('Proyecto no encontrado');
    }

    // Autorizacion server-side obligatoria (seccion 44): el userId sale del
    // JWT verificado, nunca de un campo enviado por el cliente.
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    const allMembers = await this.members.findByProjectIdWithUser(input.projectId);
    return { project, members: allMembers };
  }
}
