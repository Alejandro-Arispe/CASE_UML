import { createUmlModel, UmlModel } from '../../../domain/entities';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { ForbiddenError } from '../../errors';

export class GetOrCreateUmlModel {
  constructor(
    private readonly umlModels: UmlModelRepository,
    private readonly members: ProjectMemberRepository,
  ) {}

  async execute(input: { projectId: string; userId: string }): Promise<UmlModel> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    const existing = await this.umlModels.findByProjectId(input.projectId);
    if (existing) {
      return existing;
    }

    const empty = createUmlModel(input.projectId);
    const created = await this.umlModels.save(empty, null);
    if (created) return empty;

    // Otro cliente creo el modelo del proyecto en la misma ventana de
    // tiempo (ambos vieron "no existe"): usar el suyo en vez de fallar.
    return (await this.umlModels.findByProjectId(input.projectId)) ?? empty;
  }
}
