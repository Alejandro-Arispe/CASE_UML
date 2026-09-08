import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Conexion unica de Socket.IO, creada bajo demanda tras la autenticacion.
// El token se envia en el handshake para que el servidor valide identidad
// antes de permitir el join a la room del proyecto.
export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
      autoConnect: false,
      // Funcion en vez de valor fijo: se reevalua en cada intento de
      // (re)conexion, asi una reconexion usa el token vigente.
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
