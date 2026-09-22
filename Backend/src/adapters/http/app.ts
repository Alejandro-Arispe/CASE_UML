import express from 'express';
import cors from 'cors';
import { env } from '../../config/env';
import { container } from '../../config/container';
import { healthRoutes } from './routes/health.routes';
import { createAuthController } from './controllers/auth.controller';
import { createAuthRoutes } from './routes/auth.routes';
import { createHistoryController } from './controllers/history.controller';
import { createProjectController } from './controllers/project.controller';
import { createUmlModelController } from './controllers/umlModel.controller';
import { createValidationController } from './controllers/validation.controller';
import { createGeneratorController } from './controllers/generator.controller';
import { createProjectRoutes } from './routes/project.routes';
import { errorHandler } from './middlewares/errorHandler';
import { createLocalSpeechRoutes } from './routes/localSpeech.routes';

// Composition del adaptador HTTP: registra middlewares globales y monta
// las rutas. Las rutas de dominio (uml, ia, historial) se agregan aqui a
// medida que se implementan sus casos de uso.
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
      // El frontend necesita leer estos headers en la descarga del backend
      // generado (nombre de archivo, paquete, base de datos); por CORS, un
      // header no listado aca es invisible para el JS del otro origen aunque
      // este presente en la respuesta.
      exposedHeaders: [
        'Content-Disposition',
        'X-Generated-Package',
        'X-Generated-Database',
        'X-Generated-Port',
        'X-Generated-Db-Host',
        'X-Generated-Db-Port',
      ],
    }),
  );
  app.use(express.json());

  app.use('/api', healthRoutes);

  const authController = createAuthController(container);
  app.use('/api/auth', createAuthRoutes(authController));
  app.use('/api/local-speech', createLocalSpeechRoutes(container.tokenService));

  const projectController = createProjectController(container);
  const umlModelController = createUmlModelController(container);
  const historyController = createHistoryController(container);
  const validationController = createValidationController(container);
  const generatorController = createGeneratorController(container);
  app.use(
    '/api/projects',
    createProjectRoutes(
      projectController,
      umlModelController,
      historyController,
      validationController,
      generatorController,
      container.tokenService,
    ),
  );

  // El manejador de errores va al final: traduce excepciones de
  // dominio/aplicacion a respuestas HTTP (ver errorHandler).
  app.use(errorHandler);

  return app;
}
