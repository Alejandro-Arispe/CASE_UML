import { NextFunction, Request, Response } from 'express';
import { GetOrCreateUmlModel } from '../../../application/use-cases/uml/GetOrCreateUmlModel';
import { SaveUmlModel } from '../../../application/use-cases/uml/SaveUmlModel';

export function createUmlModelController(deps: {
  getOrCreateUmlModel: GetOrCreateUmlModel;
  saveUmlModel: SaveUmlModel;
}) {
  return {
    async get(req: Request, res: Response, next: NextFunction) {
      try {
        const model = await deps.getOrCreateUmlModel.execute({
          projectId: String(req.params.id),
          userId: req.userId!,
        });
        res.json(model);
      } catch (err) {
        next(err);
      }
    },

    async save(req: Request, res: Response, next: NextFunction) {
      try {
        const model = await deps.saveUmlModel.execute({
          projectId: String(req.params.id),
          userId: req.userId!,
          classes: req.body.classes,
          relationships: req.body.relationships,
        });
        res.json(model);
      } catch (err) {
        next(err);
      }
    },
  };
}
