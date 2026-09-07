import { NextFunction, Request, Response } from 'express';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../../application/errors';
import { DomainError } from '../../../domain/errors/DomainError';

// Middleware de error unico: traduce las excepciones de dominio/aplicacion
// al codigo HTTP correspondiente. Cualquier otro error se trata como fallo
// interno y no expone su mensaje original al cliente.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof DomainError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ error: err.message });
  }
  if (err instanceof ForbiddenError) {
    return res.status(403).json({ error: err.message });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof ConflictError) {
    return res.status(409).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
