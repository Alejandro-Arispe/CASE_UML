export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
}
