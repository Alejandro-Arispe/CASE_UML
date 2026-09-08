import { NextFunction, Request, Response } from 'express';
import { ListProjectHistory } from '../../../application/use-cases/history/ListProjectHistory';

export function createHistoryController(deps: { listProjectHistory: ListProjectHistory }) {
  return {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const entries = await deps.listProjectHistory.execute({
          projectId: String(req.params.id),
          userId: req.userId!,
          limit,
        });
        res.json(entries);
      } catch (err) {
        next(err);
      }
    },
  };
}
