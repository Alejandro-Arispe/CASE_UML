import express from 'express';
import cors from 'cors';
import { env } from '../../config/env';
import { healthRoutes } from './routes/health.routes';

// Composition del adaptador HTTP: registra middlewares globales y monta
// las rutas. Las rutas de dominio (auth, projects, uml, etc.) se agregan
// aqui a medida que se implementan sus casos de uso.
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.use('/api', healthRoutes);

  return app;
}
