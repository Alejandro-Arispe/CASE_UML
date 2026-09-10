import { UmlModel } from '../../domain/entities';

export interface UmlModelRepository {
  findByProjectId(projectId: string): Promise<UmlModel | null>;
  // Reemplaza el grafo completo (clases, atributos, relaciones) y su
  // revision, con control de concurrencia optimista: `expectedRevision` es
  // la revision que el llamador leyo antes de calcular `model` (null si
  // creia que el modelo todavia no existia). Si la revision actual en la
  // base ya no coincide -otro cliente escribio primero-, el guardado NO se
  // aplica y devuelve `false`; el llamador debe releer el modelo fresco y
  // reintentar la operacion en vez de asumir que se persistio.
  save(model: UmlModel, expectedRevision: number | null): Promise<boolean>;
}
