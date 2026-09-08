import { createUmlModel, EditHistory, UmlModel } from '../../../domain/entities';
import { AiModelClient } from '../../../ports/out/AiModelClient';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { ForbiddenError } from '../../errors';
import { ApplyUmlOperation } from '../uml/ApplyUmlOperation';
import { UmlOperationInput } from '../uml/umlOperations';
import { AiCommand } from './aiCommand';
import { buildModelSummary } from './modelSummary';
import { resolveAiCommands } from './resolveAiCommands';

export interface AppliedAiOperation {
  operation: UmlOperationInput;
  model: UmlModel;
  eventName: string;
  historyEntry: EditHistory;
}

// Orquesta el flujo de la seccion 28: IA -> comandos estructurados ->
// Action Engine (resolveAiCommands) -> UML interno -> validacion ->
// persistencia. Reutiliza el mismo ApplyUmlOperation de la Fase 6/7, asi
// cada cambio generado por IA queda persistido, versionado (revision) e
// historiado exactamente igual que uno hecho a mano en el editor.
export class RunAiCommand {
  constructor(
    private readonly umlModels: UmlModelRepository,
    private readonly members: ProjectMemberRepository,
    private readonly applyUmlOperation: ApplyUmlOperation,
    private readonly aiModelClient: AiModelClient,
  ) {}

  async execute(input: {
    projectId: string;
    userId: string;
    prompt: string;
  }): Promise<{ applied: AppliedAiOperation[]; skipped: { command: AiCommand; reason: string }[] }> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    const currentModel = (await this.umlModels.findByProjectId(input.projectId)) ?? createUmlModel(input.projectId);
    const modelSummary = buildModelSummary(currentModel);

    const commands = await this.aiModelClient.generateCommands({ prompt: input.prompt, modelSummary });
    const { operations, skipped } = resolveAiCommands(commands, currentModel);

    const applied: AppliedAiOperation[] = [];
    for (const operation of operations) {
      const result = await this.applyUmlOperation.execute({
        projectId: input.projectId,
        userId: input.userId,
        operation,
      });
      applied.push({ operation, ...result });
    }

    return { applied, skipped };
  }
}
