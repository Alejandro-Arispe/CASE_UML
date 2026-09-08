import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../../config/env';
import { TokenService } from '../../ports/out/TokenService';
import { ProjectMemberRepository } from '../../ports/out/ProjectMemberRepository';
import { ApplyUmlOperation } from '../../application/use-cases/uml/ApplyUmlOperation';
import { RunAiCommand } from '../../application/use-cases/ai/RunAiCommand';
import { DomainError } from '../../domain/errors/DomainError';
import { umlOperationSchema } from './umlOperation.schema';

interface SocketData {
  userId: string;
  projectId?: string;
}

function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

// Cuenta conexiones por usuario y proyecto (un mismo usuario puede tener
// varias pestanas abiertas). Solo quien pasa de 0 a 1 dispara "user_joined";
// solo quien baja de 1 a 0 dispara "user_left". Estado en memoria de un
// unico proceso: suficiente para el alcance del MVP (seccion 53).
class PresenceTracker {
  private readonly counts = new Map<string, Map<string, number>>();

  join(projectId: string, userId: string): boolean {
    const byUser = this.counts.get(projectId) ?? new Map<string, number>();
    const next = (byUser.get(userId) ?? 0) + 1;
    byUser.set(userId, next);
    this.counts.set(projectId, byUser);
    return next === 1;
  }

  leave(projectId: string, userId: string): boolean {
    const byUser = this.counts.get(projectId);
    if (!byUser) return false;
    const next = (byUser.get(userId) ?? 1) - 1;
    if (next <= 0) {
      byUser.delete(userId);
      if (byUser.size === 0) this.counts.delete(projectId);
      return true;
    }
    byUser.set(userId, next);
    return false;
  }

  onlineUserIds(projectId: string): string[] {
    return Array.from(this.counts.get(projectId)?.keys() ?? []);
  }
}

export function createSocketServer(
  httpServer: HttpServer,
  deps: {
    tokenService: TokenService;
    members: ProjectMemberRepository;
    applyUmlOperation: ApplyUmlOperation;
    runAiCommand: RunAiCommand;
  },
) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  const presence = new PresenceTracker();

  // Autenticacion del socket (seccion 44): el JWT viaja en el handshake, no
  // en cada evento. Sin token valido, la conexion ni siquiera se establece.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Token no proporcionado');
      const payload = deps.tokenService.verify(token);
      (socket.data as SocketData).userId = payload.userId;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on('join_project', async ({ projectId }: { projectId?: string }) => {
      if (!projectId) return;

      // Nunca se confia en la pertenencia solo porque el cliente envia un
      // projectId (seccion 20): se verifica membresia en cada join.
      const membership = await deps.members.findByProjectAndUser(projectId, data.userId);
      if (!membership) {
        socket.emit('join_rejected', { error: 'No tienes acceso a este proyecto' });
        return;
      }

      data.projectId = projectId;
      socket.join(projectRoom(projectId));

      const isFirstConnectionForUser = presence.join(projectId, data.userId);
      if (isFirstConnectionForUser) {
        socket.to(projectRoom(projectId)).emit('user_joined', { userId: data.userId });
      }
      io.to(projectRoom(projectId)).emit('presence_update', { userIds: presence.onlineUserIds(projectId) });
    });

    socket.on('leave_project', () => {
      if (!data.projectId) return;
      const projectId = data.projectId;
      socket.leave(projectRoom(projectId));
      data.projectId = undefined;

      if (presence.leave(projectId, data.userId)) {
        io.to(projectRoom(projectId)).emit('user_left', { userId: data.userId });
      }
      io.to(projectRoom(projectId)).emit('presence_update', { userIds: presence.onlineUserIds(projectId) });
    });

    socket.on('uml_operation', async (rawOperation: unknown, ack?: (res: { ok: boolean; error?: string; revision?: number }) => void) => {
      if (!data.projectId) {
        ack?.({ ok: false, error: 'No estas unido a ningun proyecto' });
        return;
      }

      const parsed = umlOperationSchema.safeParse(rawOperation);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Operacion invalida' });
        return;
      }

      try {
        const { model, eventName, historyEntry } = await deps.applyUmlOperation.execute({
          projectId: data.projectId,
          userId: data.userId,
          operation: parsed.data,
        });

        // Se difunde a los demas participantes (el emisor ya aplico el
        // cambio de forma optimista en su propio estado local).
        socket.to(projectRoom(data.projectId)).emit(eventName, { ...parsed.data, revision: model.revision });
        // El historial se difunde a todos, incluido el emisor: alimenta el
        // "ultimo movimiento" en vivo para todos los conectados (seccion 27).
        io.to(projectRoom(data.projectId)).emit('history_entry', historyEntry);
        ack?.({ ok: true, revision: model.revision });
      } catch (err) {
        const message = err instanceof DomainError || err instanceof Error ? err.message : 'Error al procesar la operacion';
        ack?.({ ok: false, error: message });
      }
    });

    socket.on(
      'ai_command',
      async (
        rawPayload: unknown,
        ack?: (res: { ok: boolean; error?: string; applied?: number; skipped?: { reason: string }[] }) => void,
      ) => {
        if (!data.projectId) {
          ack?.({ ok: false, error: 'No estas unido a ningun proyecto' });
          return;
        }

        const prompt = (rawPayload as { prompt?: unknown })?.prompt;
        if (typeof prompt !== 'string' || !prompt.trim()) {
          ack?.({ ok: false, error: 'El pedido no puede estar vacio' });
          return;
        }

        try {
          const { applied, skipped } = await deps.runAiCommand.execute({
            projectId: data.projectId,
            userId: data.userId,
            prompt,
          });

          const room = projectRoom(data.projectId);
          // A diferencia de uml_operation, aca NADIE aplico nada de forma
          // optimista (el usuario solo escribio un pedido): se difunde a
          // todos, incluido quien lo pidio, para que todos vean el
          // resultado de la IA construirse en vivo (seccion 30).
          for (const result of applied) {
            io.to(room).emit(result.eventName, { ...result.operation, revision: result.model.revision });
            io.to(room).emit('history_entry', result.historyEntry);
          }

          ack?.({ ok: true, applied: applied.length, skipped: skipped.map((s) => ({ reason: s.reason })) });
        } catch (err) {
          const message = err instanceof DomainError || err instanceof Error ? err.message : 'Error al procesar el pedido';
          ack?.({ ok: false, error: message });
        }
      },
    );

    socket.on('disconnect', () => {
      if (!data.projectId) return;
      const projectId = data.projectId;
      if (presence.leave(projectId, data.userId)) {
        io.to(projectRoom(projectId)).emit('user_left', { userId: data.userId });
      }
      io.to(projectRoom(projectId)).emit('presence_update', { userIds: presence.onlineUserIds(projectId) });
    });
  });

  return io;
}
