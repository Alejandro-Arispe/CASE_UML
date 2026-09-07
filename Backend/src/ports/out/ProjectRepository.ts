import { Project } from '../../domain/entities';

export interface ProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByInviteCode(inviteCode: string): Promise<Project | null>;
  // Proyectos donde el usuario es miembro (el owner tambien es miembro, ver
  // ProjectMember): cubre la pantalla "Mis proyectos" (seccion 7).
  findAllForUser(userId: string): Promise<Project[]>;
  save(project: Project): Promise<void>;
  touch(id: string): Promise<void>;
}
