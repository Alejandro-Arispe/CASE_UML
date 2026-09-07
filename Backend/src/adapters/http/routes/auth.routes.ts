import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller';
import { loginSchema, registerSchema } from '../dto/auth.dto';
import { validateBody } from '../middlewares/validateBody';

export function createAuthRoutes(controller: ReturnType<typeof createAuthController>) {
  const router = Router();

  router.post('/register', validateBody(registerSchema), controller.register);
  router.post('/login', validateBody(loginSchema), controller.login);

  return router;
}
