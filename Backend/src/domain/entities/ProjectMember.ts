import { randomUUID } from 'crypto';

export type ProjectRole = 'OWNER' | 'MEMBER';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
}

export function createProjectMember(params: {
  projectId: string;
  userId: string;
  role: ProjectRole;
}): ProjectMember {
  return {
    id: randomUUID(),
    projectId: params.projectId,
    userId: params.userId,
    role: params.role,
    joinedAt: new Date(),
  };
}
