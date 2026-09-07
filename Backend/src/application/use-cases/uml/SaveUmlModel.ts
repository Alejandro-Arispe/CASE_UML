import { createUmlModel, UmlClass, UmlModel, UmlRelationship } from '../../../domain/entities';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { ForbiddenError } from '../../errors';

// Guarda el grafo completo (clases + relaciones) y avanza la revision.
// Es la persistencia simple de la Fase 5 (autoguardado por REST); la Fase 6
// reemplaza/complementa esto con operaciones granulares via Socket.IO,
// donde la revision es la autoridad de orden entre clientes concurrentes.
export class SaveUmlModel {
  constructor(
    private readonly umlModels: UmlModelRepository,
    private readonly members: ProjectMemberRepository,
  ) {}

  async execute(input: {
    projectId: string;
    userId: string;
    classes: UmlClass[];
    relationships: UmlRelationship[];
  }): Promise<UmlModel> {
    // Cualquier miembro del proyecto puede editar (seccion 8: no hay roles
    // de edicion diferenciados en este alcance).
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    const current = await this.umlModels.findByProjectId(input.projectId);
    const base = current ?? createUmlModel(input.projectId);

    const model: UmlModel = {
      ...base,
      classes: input.classes,
      relationships: input.relationships,
      revision: base.revision + 1,
    };

    await this.umlModels.save(model);
    return model;
  }
}
