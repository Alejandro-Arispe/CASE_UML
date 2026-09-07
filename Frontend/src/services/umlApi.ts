import { api } from './api';
import type { UmlClass, UmlModel, UmlRelationship } from '../types/uml';

export function getUmlModel(projectId: string) {
  return api.get<UmlModel>(`/projects/${projectId}/uml-model`).then((res) => res.data);
}

export function saveUmlModel(projectId: string, classes: UmlClass[], relationships: UmlRelationship[]) {
  return api
    .put<UmlModel>(`/projects/${projectId}/uml-model`, { classes, relationships })
    .then((res) => res.data);
}
