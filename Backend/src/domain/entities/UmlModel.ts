import { randomUUID } from 'crypto';
import { UmlClass } from './UmlClass';
import { UmlRelationship } from './UmlRelationship';

// Fuente de verdad del diagrama de un proyecto (seccion 10). El diagrama
// visual en el frontend es una vista de este modelo, no al reves.
// `revision` es la autoridad de orden de operaciones (seccion 23): el
// servidor la incrementa en cada operacion aceptada.
export interface UmlModel {
  id: string;
  projectId: string;
  classes: UmlClass[];
  relationships: UmlRelationship[];
  revision: number;
}

export function createUmlModel(projectId: string): UmlModel {
  return {
    id: randomUUID(),
    projectId,
    classes: [],
    relationships: [],
    revision: 0,
  };
}
