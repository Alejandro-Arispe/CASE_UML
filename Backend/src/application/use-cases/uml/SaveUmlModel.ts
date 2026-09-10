import { createUmlModel, UmlClass, UmlModel, UmlRelationship } from '../../../domain/entities';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { concurrencyBackoff, MAX_CONCURRENCY_RETRIES } from '../../concurrencyRetry';
import { ConflictError, ForbiddenError } from '../../errors';

// Guarda el grafo completo (clases + relaciones) y avanza la revision.
// Se usa tanto para el reemplazo total via REST/import como base de
// ApplyUmlOperation para operaciones granulares via Socket.IO, donde la
// revision es la autoridad de orden entre clientes concurrentes.
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

    // Mismo control de concurrencia optimista que ApplyUmlOperation: esto
    // reemplaza el grafo entero (import/guardado REST), asi que si otro
    // cliente escribio una revision distinta mientras tanto, se relee y se
    // reintenta con el mismo `input.classes/relationships` en vez de pisar
    // silenciosamente el cambio ajeno.
    for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt++) {
      const current = await this.umlModels.findByProjectId(input.projectId);
      const base = current ?? createUmlModel(input.projectId);

      const model: UmlModel = {
        ...base,
        classes: input.classes,
        relationships: input.relationships,
        revision: base.revision + 1,
      };

      const saved = await this.umlModels.save(model, current ? current.revision : null);
      if (saved) return model;
      await concurrencyBackoff(attempt);
    }

    throw new ConflictError('No se pudo guardar el modelo: demasiadas ediciones simultaneas, intenta de nuevo');
  }
}
