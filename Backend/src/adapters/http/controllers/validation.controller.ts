import { NextFunction, Request, Response } from 'express';
import { ValidateUmlModel } from '../../../application/use-cases/uml/ValidateUmlModel';

export function createValidationController(deps: { validateUmlModel: ValidateUmlModel }) {
  return {
    async validate(req: Request, res: Response, next: NextFunction) {
      try {
        const result = await deps.validateUmlModel.execute({
          projectId: String(req.params.id),
          userId: req.userId!,
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
