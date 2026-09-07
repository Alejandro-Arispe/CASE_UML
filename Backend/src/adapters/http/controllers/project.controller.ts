import { NextFunction, Request, Response } from 'express';
import { CreateProject } from '../../../application/use-cases/projects/CreateProject';
import { GetProjectDetail } from '../../../application/use-cases/projects/GetProjectDetail';
import { JoinProjectByInviteCode } from '../../../application/use-cases/projects/JoinProjectByInviteCode';
import { ListMyProjects } from '../../../application/use-cases/projects/ListMyProjects';

export function createProjectController(deps: {
  createProject: CreateProject;
  listMyProjects: ListMyProjects;
  getProjectDetail: GetProjectDetail;
  joinProjectByInviteCode: JoinProjectByInviteCode;
}) {
  return {
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const project = await deps.createProject.execute({ name: req.body.name, ownerId: req.userId! });
        res.status(201).json(project);
      } catch (err) {
        next(err);
      }
    },

    async listMine(req: Request, res: Response, next: NextFunction) {
      try {
        const projects = await deps.listMyProjects.execute(req.userId!);
        res.json(projects);
      } catch (err) {
        next(err);
      }
    },

    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        const detail = await deps.getProjectDetail.execute({
          projectId: String(req.params.id),
          userId: req.userId!,
        });
        res.json(detail);
      } catch (err) {
        next(err);
      }
    },

    async join(req: Request, res: Response, next: NextFunction) {
      try {
        const project = await deps.joinProjectByInviteCode.execute({
          inviteCode: req.body.inviteCode,
          userId: req.userId!,
        });
        res.json(project);
      } catch (err) {
        next(err);
      }
    },
  };
}
