import { Router } from 'express';
import { TokenService } from '../../../ports/out/TokenService';
import { createGeneratorController } from '../controllers/generator.controller';
import { createHistoryController } from '../controllers/history.controller';
import { createProjectController } from '../controllers/project.controller';
import { createUmlModelController } from '../controllers/umlModel.controller';
import { createValidationController } from '../controllers/validation.controller';
import { createProjectSchema, joinProjectSchema } from '../dto/project.dto';
import { saveUmlModelSchema } from '../dto/umlModel.dto';
import { requireAuth } from '../middlewares/requireAuth';
import { validateBody } from '../middlewares/validateBody';

export function createProjectRoutes(
  controller: ReturnType<typeof createProjectController>,
  umlModelController: ReturnType<typeof createUmlModelController>,
  historyController: ReturnType<typeof createHistoryController>,
  validationController: ReturnType<typeof createValidationController>,
  generatorController: ReturnType<typeof createGeneratorController>,
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
  router.get('/:id/history', historyController.list);
  router.get('/:id/validate', validationController.validate);
  router.post('/:id/generate-backend', generatorController.generate);

  return router;
}
