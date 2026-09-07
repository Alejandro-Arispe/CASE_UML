import { Project } from '../../../domain/entities';
import { ProjectRepository } from '../../../ports/out/ProjectRepository';

export class ListMyProjects {
  constructor(private readonly projects: ProjectRepository) {}

  execute(userId: string): Promise<Project[]> {
    return this.projects.findAllForUser(userId);
  }
}
