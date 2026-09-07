import { randomUUID } from 'crypto';
import { DomainError } from '../errors/DomainError';
import { UmlAttribute } from './UmlAttribute';

export interface UmlPosition {
  x: number;
  y: number;
}

export interface UmlClass {
  id: string;
  name: string;
  position: UmlPosition;
  attributes: UmlAttribute[];
}

export function createUmlClass(params: { name: string; position?: UmlPosition }): UmlClass {
  const name = params.name.trim();

  if (!name) {
    throw new DomainError('La clase debe tener un nombre');
  }

  return {
    id: randomUUID(),
    name,
    position: params.position ?? { x: 0, y: 0 },
    attributes: [],
  };
}
