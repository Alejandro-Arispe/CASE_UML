import { api } from './api';
import type { Project, ProjectMember } from '../types/auth';

export function listMyProjects() {
  return api.get<Project[]>('/projects').then((res) => res.data);
}

export function createProject(name: string) {
  return api.post<Project>('/projects', { name }).then((res) => res.data);
}

export function getProjectDetail(projectId: string) {
  return api
    .get<{ project: Project; members: ProjectMember[] }>(`/projects/${projectId}`)
    .then((res) => res.data);
}

export function joinProjectByInviteCode(inviteCode: string) {
  return api.post<Project>('/projects/join', { inviteCode }).then((res) => res.data);
}
