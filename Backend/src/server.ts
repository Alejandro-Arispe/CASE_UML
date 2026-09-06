import { createServer } from 'http';
import { env } from './config/env';
import { createApp } from './adapters/http/app';
import { createSocketServer } from './adapters/socket/socket.gateway';

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(env.port, () => {
  console.log(`CASE_UML backend escuchando en http://localhost:${env.port}`);
});
