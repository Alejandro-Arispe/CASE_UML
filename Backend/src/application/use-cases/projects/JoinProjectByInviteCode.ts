import { createProjectMember, Project } from '../../../domain/entities';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { ProjectRepository } from '../../../ports/out/ProjectRepository';
import { NotFoundError } from '../../errors';

export class JoinProjectByInviteCode {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly members: ProjectMemberRepository,
  ) {}

  async execute(input: { inviteCode: string; userId: string }): Promise<Project> {
    // El backend valida codigo y proyecto en servidor (seccion 9); nunca se
    // confia en un projectId enviado directamente por el cliente.
    const project = await this.projects.findByInviteCode(input.inviteCode.trim().toUpperCase());
    if (!project) {
      throw new NotFoundError('Codigo de invitacion invalido');
    }

    const existing = await this.members.findByProjectAndUser(project.id, input.userId);
    if (existing) {
      return project;
    }

    const member = createProjectMember({ projectId: project.id, userId: input.userId, role: 'MEMBER' });
    await this.members.save(member);
    return project;
  }
}
