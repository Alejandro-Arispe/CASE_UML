import { createServer } from 'http';
import { env } from './config/env';
import { container } from './config/container';
import { createApp } from './adapters/http/app';
import { createSocketServer } from './adapters/socket/socket.gateway';

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer, {
  tokenService: container.tokenService,
  members: container.projectMemberRepository,
  applyUmlOperation: container.applyUmlOperation,
  runAiCommand: container.runAiCommand,
  saveUmlModel: container.saveUmlModel,
});

httpServer.listen(env.port, () => {
  console.log(`CASE_UML backend escuchando en http://localhost:${env.port}`);
});
