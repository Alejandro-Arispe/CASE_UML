import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../../config/env';

// Punto de entrada de la colaboracion en tiempo real. La autenticacion del
// socket y el manejo de eventos de dominio (join_project, class_created, etc.)
// se agregan en la fase de colaboracion; aqui solo se deja cableado el server.
export function createSocketServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      // Los handlers de dominio (leave_project, presence_update) se agregan
      // junto con la autenticacion de sockets.
    });
  });

  return io;
}
