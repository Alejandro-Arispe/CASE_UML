import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../../application/errors';
import { TokenService } from '../../../ports/out/TokenService';

const BEARER_PREFIX = 'Bearer ';

// Verifica el JWT y adjunta el userId a la request. Toda ruta que modifique
// o lea datos de un proyecto debe pasar por aqui (seccion 44): nunca se
// confia en un userId enviado por el cliente.
export function requireAuth(tokenService: TokenService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) {
      return next(new UnauthorizedError('Token no proporcionado'));
    }

    try {
      const payload = tokenService.verify(header.slice(BEARER_PREFIX.length));
      req.userId = payload.userId;
      next();
    } catch {
      next(new UnauthorizedError('Token invalido o expirado'));
    }
  };
}
