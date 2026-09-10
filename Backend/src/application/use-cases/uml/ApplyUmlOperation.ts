import { createEditHistory, createUmlModel, EditHistory, UmlModel } from '../../../domain/entities';
import { EditHistoryRepository } from '../../../ports/out/EditHistoryRepository';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { concurrencyBackoff, MAX_CONCURRENCY_RETRIES } from '../../concurrencyRetry';
import { ConflictError, ForbiddenError } from '../../errors';
import { describeUmlOperation } from './describeUmlOperation';
import { applyOperationToModel, OPERATION_EVENT_NAME, UmlOperationInput } from './umlOperations';

// El servidor es la autoridad sobre el orden de operaciones (seccion 23):
// cada operacion aceptada avanza `revision` en uno y se persiste antes de
// confirmarse. El gateway de sockets solo llama a este caso de uso y
// difunde el evento resultante; no conoce reglas de negocio.
export class ApplyUmlOperation {
  constructor(
    private readonly umlModels: UmlModelRepository,
    private readonly members: ProjectMemberRepository,
    private readonly history: EditHistoryRepository,
  ) {}

  async execute(input: {
    projectId: string;
    userId: string;
    operation: UmlOperationInput;
  }): Promise<{ model: UmlModel; eventName: string; historyEntry: EditHistory }> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    // Control de concurrencia optimista: si otro cliente escribio una
    // revision distinta entre que leemos `before` y que guardamos, `save`
    // devuelve false sin escribir nada. En vez de pisar ese cambio (lost
    // update) o descartar la operacion de este usuario, se relee el modelo
    // fresco y se reaplica la MISMA operacion sobre la base actualizada.
    for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt++) {
      const existing = await this.umlModels.findByProjectId(input.projectId);
      const before = existing ?? createUmlModel(input.projectId);

      const updated = applyOperationToModel(before, input.operation);
      const model: UmlModel = { ...updated, revision: before.revision + 1 };

      const saved = await this.umlModels.save(model, existing ? existing.revision : null);
      if (!saved) {
        await concurrencyBackoff(attempt);
        continue;
      }

      // El historial se registra junto con la operacion (seccion 27): cada
      // cambio aceptado queda trazado con quien, que y en que revision.
      const { elementType, elementId, description } = describeUmlOperation(input.operation, before, model);
      const historyEntry = createEditHistory({
        projectId: input.projectId,
        userId: input.userId,
        operation: input.operation.operation,
        elementType,
        elementId,
        description,
        revision: model.revision,
      });
      await this.history.add(historyEntry);

      return { model, eventName: OPERATION_EVENT_NAME[input.operation.operation], historyEntry };
    }

    throw new ConflictError('No se pudo aplicar el cambio: demasiadas ediciones simultaneas, intenta de nuevo');
  }
}
