import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { z } from 'zod';
import { OPERATION_EVENT_NAME } from '../../application/use-cases/uml/umlOperations';
import { env } from '../../config/env';
import { TokenService } from '../../ports/out/TokenService';
import { ProjectMemberRepository } from '../../ports/out/ProjectMemberRepository';
import { ApplyUmlOperation } from '../../application/use-cases/uml/ApplyUmlOperation';
import { SaveUmlModel } from '../../application/use-cases/uml/SaveUmlModel';
import { RunAiCommand } from '../../application/use-cases/ai/RunAiCommand';
import { DomainError } from '../../domain/errors/DomainError';
import { ConflictError, ForbiddenError } from '../../application/errors';
import { umlOperationSchema } from './umlOperation.schema';
import { saveUmlModelSchema } from '../http/dto/umlModel.dto';

// Solo los errores "esperables" (reglas de negocio, permisos, concurrencia)
// llevan su mensaje al cliente; cualquier otro (Prisma, red, bugs) se loguea
// en el servidor y el cliente recibe un mensaje generico, igual que en el
// errorHandler HTTP.
function clientErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DomainError || err instanceof ForbiddenError || err instanceof ConflictError) {
    return err.message;
  }
  console.error(err);
  return fallback;
}

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
    saveUmlModel: SaveUmlModel;
  },
) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    // Default de Socket.IO es 1MB: una foto de un diagrama de pizarra
    // (aunque se comprime en el cliente antes de enviarla) puede superarlo.
    maxHttpBufferSize: 8 * 1024 * 1024,
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
        if (historyEntry) io.to(projectRoom(data.projectId)).emit('history_entry', historyEntry);
        ack?.({ ok: true, revision: model.revision });
      } catch (err) {
        ack?.({ ok: false, error: clientErrorMessage(err, 'Error al procesar la operacion') });
      }
    });

    // Lote de operaciones de un mismo gesto (organizar diagrama, alinear,
    // duplicar una clase con sus atributos): una sola transaccion y revision.
    socket.on('uml_operations', async (rawOperations: unknown, ack?: (res: { ok: boolean; error?: string; revision?: number }) => void) => {
      if (!data.projectId) {
        ack?.({ ok: false, error: 'No estas unido a ningun proyecto' });
        return;
      }

      const parsed = z.array(umlOperationSchema).min(1).max(500).safeParse(rawOperations);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Operaciones invalidas' });
        return;
      }

      try {
        const { model, historyEntries } = await deps.applyUmlOperation.executeBatch({
          projectId: data.projectId,
          userId: data.userId,
          operations: parsed.data,
        });

        const room = projectRoom(data.projectId);
        for (const operation of parsed.data) {
          socket.to(room).emit(OPERATION_EVENT_NAME[operation.operation], { ...operation, revision: model.revision });
        }
        const lastEntry = historyEntries[historyEntries.length - 1];
        if (lastEntry) io.to(room).emit('history_entry', lastEntry);
        ack?.({ ok: true, revision: model.revision });
      } catch (err) {
        ack?.({ ok: false, error: clientErrorMessage(err, 'Error al procesar las operaciones') });
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

        const payload = rawPayload as { prompt?: unknown; image?: { data?: unknown; mimeType?: unknown } };
        const prompt = typeof payload?.prompt === 'string' && payload.prompt.trim() ? payload.prompt : undefined;
        const image =
          typeof payload?.image?.data === 'string' && typeof payload.image.mimeType === 'string'
            ? { data: payload.image.data, mimeType: payload.image.mimeType }
            : undefined;

        if (!prompt && !image) {
          ack?.({ ok: false, error: 'El pedido no puede estar vacio' });
          return;
        }

        try {
          const { model, historyEntries, appliedCount, skipped } = await deps.runAiCommand.execute({
            projectId: data.projectId,
            userId: data.userId,
            prompt,
            image,
          });

          // A diferencia de uml_operation, aca NADIE aplico nada de forma
          // optimista (el usuario solo escribio un pedido): el lote completo
          // se aplico en una transaccion y se difunde a todos, incluido quien
          // lo pidio, como reemplazo del modelo (seccion 30).
          if (model) {
            const room = projectRoom(data.projectId);
            io.to(room).emit('model_replaced', model);
            const lastEntry = historyEntries[historyEntries.length - 1];
            if (lastEntry) io.to(room).emit('history_entry', lastEntry);
          }

          ack?.({ ok: true, applied: appliedCount, skipped: skipped.map((s) => ({ reason: s.reason })) });
        } catch (err) {
          ack?.({ ok: false, error: clientErrorMessage(err, 'Error al procesar el pedido con la IA') });
        }
      },
    );

    socket.on(
      'import_model',
      async (rawPayload: unknown, ack?: (res: { ok: boolean; error?: string; revision?: number }) => void) => {
        if (!data.projectId) {
          ack?.({ ok: false, error: 'No estas unido a ningun proyecto' });
          return;
        }

        const parsed = saveUmlModelSchema.safeParse(rawPayload);
        if (!parsed.success) {
          ack?.({ ok: false, error: 'El archivo importado no tiene un formato valido' });
          return;
        }

        try {
          const model = await deps.saveUmlModel.execute({
            projectId: data.projectId,
            userId: data.userId,
            classes: parsed.data.classes,
            relationships: parsed.data.relationships,
          });

          // Reemplazo total del modelo: a diferencia de uml_operation, no
          // hay un set chico de campos que traducir a un evento puntual, asi
          // que se avisa a TODOS (incluido quien importo) para que vuelvan a
          // cargar el modelo completo desde el servidor.
          io.to(projectRoom(data.projectId)).emit('model_replaced', model);
          ack?.({ ok: true, revision: model.revision });
        } catch (err) {
          ack?.({ ok: false, error: clientErrorMessage(err, 'Error al importar el modelo') });
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
