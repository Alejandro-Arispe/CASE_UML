import { randomUUID } from 'crypto';
import { DomainError } from '../errors/DomainError';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El dominio recibe el hash ya calculado: hashear la contrasena es una
// decision de infraestructura (bcrypt en un adaptador), no del dominio.
export function createUser(params: { name: string; email: string; passwordHash: string }): User {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();

  if (!name) {
    throw new DomainError('El usuario debe tener un nombre');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new DomainError('El correo del usuario no es valido');
  }

  return {
    id: randomUUID(),
    name,
    email,
    passwordHash: params.passwordHash,
    createdAt: new Date(),
  };
}
