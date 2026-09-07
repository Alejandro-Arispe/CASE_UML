import { ProjectMember } from '../../domain/entities';

// Vista de lectura para la pantalla de integrantes (seccion 25): necesita
// mostrar nombre, no solo el userId.
export interface ProjectMemberWithUser extends ProjectMember {
  userName: string;
  userEmail: string;
}

export interface ProjectMemberRepository {
  findByProjectId(projectId: string): Promise<ProjectMember[]>;
  findByProjectIdWithUser(projectId: string): Promise<ProjectMemberWithUser[]>;
  findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMember | null>;
  save(member: ProjectMember): Promise<void>;
}
