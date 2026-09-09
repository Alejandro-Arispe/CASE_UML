import { env } from '../../../config/env';
import { createUmlModel } from '../../../domain/entities';
import { validateUmlModel } from '../../../domain/validation/validateUmlModel';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { ProjectRepository } from '../../../ports/out/ProjectRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { ForbiddenError, ModelInvalidError, NotFoundError } from '../../errors';
import { buildGenerationModel } from '../../../generator/buildGenerationModel';
import { ensureDatabaseExists } from '../../../generator/ensureDatabaseExists';
import { shortProjectId } from '../../../generator/naming';
import { WriteGeneratedProjectResult, writeGeneratedProject } from '../../../generator/writeGeneratedProject';

const GENERATED_APP_PORT = 8081;

// Orquesta el flujo de la seccion 31: UML validado -> Generation Model ->
// Template Engine -> Spring Boot. Deterministico: el mismo UML valido
// siempre produce el mismo resultado (no interviene ninguna IA aca).
export class GenerateBackend {
  constructor(
    private readonly umlModels: UmlModelRepository,
    private readonly members: ProjectMemberRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: { projectId: string; userId: string }): Promise<WriteGeneratedProjectResult & { dbHost: string; dbPort: number }> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    const project = await this.projects.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('Proyecto no encontrado');
    }

    const model = (await this.umlModels.findByProjectId(input.projectId)) ?? createUmlModel(input.projectId);

    // Seccion 17: nunca generar en silencio un backend invalido.
    const validation = validateUmlModel(model);
    if (!validation.valid) {
      throw new ModelInvalidError(validation.issues);
    }

    const generationModel = buildGenerationModel(model, input.projectId);
    await ensureDatabaseExists(generationModel.databaseName);

    const dbUrl = new URL(env.databaseUrl);
    const dbPort = Number(dbUrl.port || 5432);

    const result = writeGeneratedProject(generationModel, input.projectId, {
      artifactId: `gen-${shortProjectId(input.projectId)}`,
      port: GENERATED_APP_PORT,
      dbPort,
    });

    return { ...result, dbHost: dbUrl.hostname, dbPort };
  }
}
