import { createUmlModel } from '../../../domain/entities';
import { ValidationResult } from '../../../domain/validation/ValidationIssue';
import { validateUmlModel } from '../../../domain/validation/validateUmlModel';
import { ProjectMemberRepository } from '../../../ports/out/ProjectMemberRepository';
import { UmlModelRepository } from '../../../ports/out/UmlModelRepository';
import { ForbiddenError } from '../../errors';

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
    return validateUmlModel(model);
  }
}
