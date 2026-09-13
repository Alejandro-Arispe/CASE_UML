import { createUmlModel, EditHistory, UmlModel } from '../../../domain/entities';
import { AiModelClient } from '../../../ports/out/AiModelClient';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { DomainError } from '../../../domain/errors/DomainError';
import { ForbiddenError } from '../../errors';
import { ApplyUmlOperation } from '../uml/ApplyUmlOperation';
import { AiCommand } from './aiCommand';
import { buildModelSummary } from './modelSummary';
import { resolveAiCommands } from './resolveAiCommands';

// Formatos que Gemini acepta como "archivo con un diagrama".
export const AI_FILE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export interface RunAiCommandResult {
  // null si la IA no produjo ningun cambio aplicable.
  model: UmlModel | null;
  historyEntries: EditHistory[];
  appliedCount: number;
  skipped: { command: AiCommand; reason: string }[];
}

// Orquesta el flujo de la seccion 28: IA -> comandos estructurados ->
// Action Engine (resolveAiCommands) -> UML interno -> persistencia. Todas
// las operaciones resueltas se aplican en UN lote (una transaccion): mucho
// mas rapido que una escritura por operacion y sin modelos a medias.
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
    prompt?: string;
    image?: { data: string; mimeType: string };
  }): Promise<RunAiCommandResult> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }
    if (!input.prompt && !input.image) {
      throw new DomainError('Falta el pedido (texto o archivo)');
    }
    if (input.image && !(AI_FILE_MIME_TYPES as readonly string[]).includes(input.image.mimeType)) {
      throw new DomainError('Formato no soportado: usa JPG, PNG, WEBP, HEIC o PDF');
    }

    const currentModel = (await this.umlModels.findByProjectId(input.projectId)) ?? createUmlModel(input.projectId);
    const modelSummary = buildModelSummary(currentModel);

    const commands = input.image
      ? await this.aiModelClient.generateCommandsFromImage({
          imageBase64: input.image.data,
          mimeType: input.image.mimeType,
          modelSummary,
          prompt: input.prompt,
        })
      : await this.aiModelClient.generateCommands({ prompt: input.prompt!, modelSummary });

    // Se resuelve contra el modelo leido; si otro usuario edito mientras la
    // IA pensaba, executeBatch reaplica sobre el modelo fresco (y si alguna
    // operacion ya no es valida, el lote completo se rechaza con su motivo).
    const { operations, skipped } = resolveAiCommands(commands, currentModel);
    if (operations.length === 0) {
      return { model: null, historyEntries: [], appliedCount: 0, skipped };
    }

    const { model, historyEntries } = await this.applyUmlOperation.executeBatch({
      projectId: input.projectId,
      userId: input.userId,
      operations,
    });

    return { model, historyEntries, appliedCount: operations.length, skipped };
  }
}
