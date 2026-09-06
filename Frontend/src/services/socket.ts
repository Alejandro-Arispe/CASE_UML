import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Conexion unica de Socket.IO, creada bajo demanda tras la autenticacion.
// El token se envia en el handshake para que el servidor valide identidad
// antes de permitir el join a la room del proyecto.
export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
      autoConnect: false,
      auth: { token },
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
