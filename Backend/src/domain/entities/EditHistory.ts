import { randomUUID } from 'crypto';

// Operaciones registrables sobre el modelo UML (secciones 21 y 29).
// GENERATE_MODEL/VALIDATE_MODEL no se registran aqui porque no modifican
// un elemento puntual del diagrama.
export type EditOperation =
  | 'CREATE_CLASS'
  | 'DELETE_CLASS'
  | 'RENAME_CLASS'
  | 'ADD_ATTRIBUTE'
  | 'REMOVE_ATTRIBUTE'
  | 'UPDATE_ATTRIBUTE'
  | 'CREATE_RELATIONSHIP'
  | 'UPDATE_RELATIONSHIP'
  | 'DELETE_RELATIONSHIP'
  | 'SET_MULTIPLICITY'
  | 'MOVE_ELEMENT';

export type EditElementType = 'CLASS' | 'ATTRIBUTE' | 'RELATIONSHIP';

export interface EditHistory {
  id: string;
  projectId: string;
  userId: string;
  operation: EditOperation;
  elementType: EditElementType;
  elementId: string;
  description: string;
  timestamp: Date;
  revision: number;
}

// La revision la determina quien procesa la operacion (ya conoce la
// revision resultante del UmlModel); el dominio solo arma el registro.
export function createEditHistory(params: {
  projectId: string;
  userId: string;
  operation: EditOperation;
  elementType: EditElementType;
  elementId: string;
  description: string;
  revision: number;
}): EditHistory {
  return {
    id: randomUUID(),
    timestamp: new Date(),
    ...params,
  };
}
