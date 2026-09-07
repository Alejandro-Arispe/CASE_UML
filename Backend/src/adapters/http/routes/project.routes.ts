import { Router } from 'express';
import { TokenService } from '../../../ports/out/TokenService';
import { createProjectController } from '../controllers/project.controller';
import { createUmlModelController } from '../controllers/umlModel.controller';
import { createProjectSchema, joinProjectSchema } from '../dto/project.dto';
import { saveUmlModelSchema } from '../dto/umlModel.dto';
import { requireAuth } from '../middlewares/requireAuth';
import { validateBody } from '../middlewares/validateBody';

export function createProjectRoutes(
  controller: ReturnType<typeof createProjectController>,
  umlModelController: ReturnType<typeof createUmlModelController>,
  tokenService: TokenService,
) {
  const router = Router();

  router.use(requireAuth(tokenService));

  router.post('/', validateBody(createProjectSchema), controller.create);
  router.get('/', controller.listMine);
  router.post('/join', validateBody(joinProjectSchema), controller.join);
  router.get('/:id', controller.getById);
  router.get('/:id/uml-model', umlModelController.get);
  router.put('/:id/uml-model', validateBody(saveUmlModelSchema), umlModelController.save);

  return router;
}
