import { createUmlModel, UmlModel } from '../../../domain/entities';
import { toValidationResult, ValidationResult } from '../../../domain/validation/ValidationIssue';
import { validateUmlModel } from '../../../domain/validation/validateUmlModel';
import { GenerationPlan, planGeneration } from '../../../generator/planGeneration';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { ForbiddenError } from '../../errors';

// Validacion completa = estructura del modelo + reglas de generacion. Las
// reglas de generacion solo se evaluan si la estructura es valida (con
// clases inexistentes o herencia circular no tiene sentido planificar).
// "Validar modelo" y "Generar backend" usan exactamente esta funcion, asi
// que muestran la misma lista de problemas.
export function validateForGeneration(
  model: UmlModel,
  projectId: string,
): { result: ValidationResult; plan: GenerationPlan | null } {
  const structural = validateUmlModel(model);
  if (!structural.valid) return { result: structural, plan: null };

  const plan = planGeneration(model, projectId);
  return { result: toValidationResult([...structural.issues, ...plan.issues]), plan };
}

export class ValidateUmlModel {
  constructor(
    private readonly umlModels: UmlModelRepository,
    private readonly members: ProjectMemberRepository,
  ) {}

  async execute(input: { projectId: string; userId: string }): Promise<ValidationResult> {
    const membership = await this.members.findByProjectAndUser(input.projectId, input.userId);
    if (!membership) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

    const model = (await this.umlModels.findByProjectId(input.projectId)) ?? createUmlModel(input.projectId);
    return validateForGeneration(model, input.projectId).result;
  }
}
