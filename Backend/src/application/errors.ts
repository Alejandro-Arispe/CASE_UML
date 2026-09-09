import { ValidationIssue } from '../domain/validation/ValidationIssue';

// Errores de aplicacion: distintos de DomainError (invariantes del modelo).
// Existen para que el adaptador HTTP pueda mapear cada caso al codigo de
// estado correcto sin inspeccionar mensajes de texto.

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Seccion 17: "no generar silenciosamente un backend invalido". El
// generador rechaza el pedido con la misma lista de issues que devuelve el
// endpoint de validacion, para que el frontend pueda mostrar el mismo panel.
export class ModelInvalidError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super('El modelo UML no es valido para generar el backend');
    this.name = 'ModelInvalidError';
  }
}
