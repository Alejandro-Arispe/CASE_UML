import { UmlModel } from '../../domain/entities';

export interface UmlModelRepository {
  findByProjectId(projectId: string): Promise<UmlModel | null>;
  // Reemplaza el grafo completo (clases, atributos, relaciones) y su
  // revision. Los metodos para aplicar operaciones granulares (agregar un
  // atributo, mover una clase, etc.) se agregan en la fase de edicion/
  // colaboracion, cuando exista el motor que las procesa.
  save(model: UmlModel): Promise<void>;
}
