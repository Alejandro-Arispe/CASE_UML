import express from 'express';
import cors from 'cors';
import { env } from '../../config/env';
import { container } from '../../config/container';
import { healthRoutes } from './routes/health.routes';
import { createAuthController } from './controllers/auth.controller';
import { createAuthRoutes } from './routes/auth.routes';
import { createProjectController } from './controllers/project.controller';
import { createUmlModelController } from './controllers/umlModel.controller';
import { createProjectRoutes } from './routes/project.routes';
import { errorHandler } from './middlewares/errorHandler';

// Composition del adaptador HTTP: registra middlewares globales y monta
// las rutas. Las rutas de dominio (uml, ia, historial) se agregan aqui a
// medida que se implementan sus casos de uso.
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.use('/api', healthRoutes);

  const authController = createAuthController(container);
  app.use('/api/auth', createAuthRoutes(authController));

  const projectController = createProjectController(container);
  const umlModelController = createUmlModelController(container);
  app.use('/api/projects', createProjectRoutes(projectController, umlModelController, container.tokenService));

  // El manejador de errores va al final: traduce excepciones de
  // dominio/aplicacion a respuestas HTTP (ver errorHandler).
  app.use(errorHandler);

  return app;
}
