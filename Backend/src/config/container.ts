import { GeminiAiModelClient } from '../adapters/ai/GeminiAiModelClient';
import { prisma } from '../adapters/persistence/prisma';
import { PrismaEditHistoryRepository } from '../adapters/persistence/PrismaEditHistoryRepository';
import { PrismaProjectMemberRepository } from '../adapters/persistence/PrismaProjectMemberRepository';
import { PrismaProjectRepository } from '../adapters/persistence/PrismaProjectRepository';
import { PrismaUmlModelRepository } from '../adapters/persistence/PrismaUmlModelRepository';
import { PrismaUserRepository } from '../adapters/persistence/PrismaUserRepository';
import { BcryptPasswordHasher } from '../adapters/security/BcryptPasswordHasher';
import { JwtTokenService } from '../adapters/security/JwtTokenService';
import { LoginUser } from '../application/use-cases/auth/LoginUser';
import { RegisterUser } from '../application/use-cases/auth/RegisterUser';
import { RunAiCommand } from '../application/use-cases/ai/RunAiCommand';
import { ListProjectHistory } from '../application/use-cases/history/ListProjectHistory';
import { GenerateBackend } from '../application/use-cases/generator/GenerateBackend';
import { CreateProject } from '../application/use-cases/projects/CreateProject';
import { GetProjectDetail } from '../application/use-cases/projects/GetProjectDetail';
import { JoinProjectByInviteCode } from '../application/use-cases/projects/JoinProjectByInviteCode';
import { ListMyProjects } from '../application/use-cases/projects/ListMyProjects';
import { ApplyUmlOperation } from '../application/use-cases/uml/ApplyUmlOperation';
import { GetOrCreateUmlModel } from '../application/use-cases/uml/GetOrCreateUmlModel';
import { SaveUmlModel } from '../application/use-cases/uml/SaveUmlModel';
import { ValidateUmlModel } from '../application/use-cases/uml/ValidateUmlModel';

// Composition root: unico lugar donde se instancian adaptadores concretos
// y se inyectan en los casos de uso. El resto de la app solo ve interfaces.
const userRepository = new PrismaUserRepository(prisma);
const projectRepository = new PrismaProjectRepository(prisma);
const projectMemberRepository = new PrismaProjectMemberRepository(prisma);
const umlModelRepository = new PrismaUmlModelRepository(prisma);
const editHistoryRepository = new PrismaEditHistoryRepository(prisma);

const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService();
const aiModelClient = new GeminiAiModelClient();

const applyUmlOperation = new ApplyUmlOperation(umlModelRepository, projectMemberRepository, editHistoryRepository);

export const container = {
  tokenService,
  projectMemberRepository,

  registerUser: new RegisterUser(userRepository, passwordHasher),
  loginUser: new LoginUser(userRepository, passwordHasher, tokenService),

  createProject: new CreateProject(projectRepository, projectMemberRepository),
  listMyProjects: new ListMyProjects(projectRepository),
  getProjectDetail: new GetProjectDetail(projectRepository, projectMemberRepository),
  joinProjectByInviteCode: new JoinProjectByInviteCode(projectRepository, projectMemberRepository),

  getOrCreateUmlModel: new GetOrCreateUmlModel(umlModelRepository, projectMemberRepository),
  saveUmlModel: new SaveUmlModel(umlModelRepository, projectMemberRepository),
  applyUmlOperation,
  validateUmlModel: new ValidateUmlModel(umlModelRepository, projectMemberRepository),

  listProjectHistory: new ListProjectHistory(editHistoryRepository, projectMemberRepository),

  runAiCommand: new RunAiCommand(umlModelRepository, projectMemberRepository, applyUmlOperation, aiModelClient),

  generateBackend: new GenerateBackend(umlModelRepository, projectMemberRepository, projectRepository),
};
