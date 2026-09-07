import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { DomainError } from '../../../domain/errors/DomainError';

// Valida y normaliza el body contra un schema zod antes de llegar al
// controller. Nunca se confia en la forma de los datos enviados por el cliente.
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new DomainError(result.error.issues.map((issue) => issue.message).join(', ')));
    }
    req.body = result.data;
    next();
  };
}
