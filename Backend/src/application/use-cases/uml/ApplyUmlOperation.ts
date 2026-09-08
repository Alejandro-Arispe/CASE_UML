import { createEditHistory, createUmlModel, EditHistory, UmlModel } from '../../../domain/entities';
import { EditHistoryRepository } from '../../../ports/out/EditHistoryRepository';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { ForbiddenError } from '../../errors';
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

    const before = (await this.umlModels.findByProjectId(input.projectId)) ?? createUmlModel(input.projectId);

    const updated = applyOperationToModel(before, input.operation);
    const model: UmlModel = { ...updated, revision: before.revision + 1 };

    await this.umlModels.save(model);

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
}
