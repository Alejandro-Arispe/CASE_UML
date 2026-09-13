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
  }): Promise<{ model: UmlModel; eventName: string; historyEntry?: EditHistory }> {
    const { model, historyEntries } = await this.executeBatch({
      projectId: input.projectId,
      userId: input.userId,
      operations: [input.operation],
    });
    return { model, eventName: OPERATION_EVENT_NAME[input.operation.operation], historyEntry: historyEntries[0] };
  }

  // Aplica varias operaciones como UNA sola escritura (una transaccion y una
  // revision): la IA puede producir decenas de operaciones por pedido, y
  // aplicarlas de a una era lento y dejaba un modelo a medias si alguna
  // fallaba en el medio. Si cualquier operacion es invalida no se guarda
  // ninguna.
  async executeBatch(input: {
    projectId: string;
    userId: string;
    operations: UmlOperationInput[];
  }): Promise<{ model: UmlModel; historyEntries: EditHistory[] }> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    // Control de concurrencia optimista: si otro cliente escribio una
    // revision distinta entre que leemos `before` y que guardamos, `save`
    // devuelve false sin escribir nada. En vez de pisar ese cambio (lost
    // update) o descartar la operacion de este usuario, se relee el modelo
    // fresco y se reaplican las MISMAS operaciones sobre la base actualizada.
    for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt++) {
      const existing = await this.umlModels.findByProjectId(input.projectId);
      const before = existing ?? createUmlModel(input.projectId);

      let current = before;
      const descriptions: ReturnType<typeof describeUmlOperation>[] = [];
      for (const operation of input.operations) {
        const next = applyOperationToModel(current, operation);
        descriptions.push(describeUmlOperation(operation, current, next));
        current = next;
      }
      const model: UmlModel = { ...current, revision: before.revision + 1 };

      const saved = await this.umlModels.save(model, existing ? existing.revision : null, existing);
      if (!saved) {
        await concurrencyBackoff(attempt);
        continue;
      }

      // El historial se registra junto con la operacion (seccion 27): cada
      // cambio aceptado queda trazado con quien, que y en que revision.
      // En un lote, cada entrada se separa 1ms para que el historial (que se
      // ordena por timestamp) conserve el orden en que se aplicaron.
      // Mover una clase no se historia (como en Enterprise Architect): cada
      // arrastre generaba una entrada y tapaba los cambios que importan.
      const baseTime = Date.now();
      const historyEntries = input.operations.flatMap((operation, index) =>
        operation.operation === 'MOVE_ELEMENT'
          ? []
          : [
              {
                ...createEditHistory({
                  projectId: input.projectId,
                  userId: input.userId,
                  operation: operation.operation,
                  ...descriptions[index],
                  revision: model.revision,
                }),
                timestamp: new Date(baseTime + index),
              },
            ],
      );
      await this.history.addMany(historyEntries);

      return { model, historyEntries };
    }

    throw new ConflictError('No se pudo aplicar el cambio: demasiadas ediciones simultaneas, intenta de nuevo');
  }
}
