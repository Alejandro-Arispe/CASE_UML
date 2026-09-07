import { randomUUID } from 'crypto';
import { DomainError } from '../errors/DomainError';

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

// Codigo corto para invitar miembros (ver seccion 9), ej. "SIS-482".
// No es un identificador estable del proyecto: solo sirve para compartir
// una invitacion, el id sigue siendo el UUID.
function generateInviteCode(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').slice(0, 3);
  const number = Math.floor(100 + Math.random() * 900);
  return `${letters}-${number}`;
}

export function createProject(params: { name: string; ownerId: string }): Project {
  const name = params.name.trim();

  if (!name) {
    throw new DomainError('El proyecto debe tener un nombre');
  }

  const now = new Date();
  return {
    id: randomUUID(),
    name,
    ownerId: params.ownerId,
    inviteCode: generateInviteCode(name),
    createdAt: now,
    updatedAt: now,
  };
}
