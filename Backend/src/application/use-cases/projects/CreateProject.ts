import { createProject, createProjectMember, Project } from '../../../domain/entities';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { ProjectRepository } from '../../../ports/out/ProjectRepository';

export class CreateProject {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly members: ProjectMemberRepository,
  ) {}

  async execute(input: { name: string; ownerId: string }): Promise<Project> {
    const project = createProject({ name: input.name, ownerId: input.ownerId });
    await this.projects.save(project);

    // El owner tambien queda como ProjectMember (rol OWNER): asi "mis
    // proyectos" y la lista de integrantes se resuelven con una sola tabla.
    const owner = createProjectMember({ projectId: project.id, userId: input.ownerId, role: 'OWNER' });
    await this.members.save(owner);

    return project;
  }
}
