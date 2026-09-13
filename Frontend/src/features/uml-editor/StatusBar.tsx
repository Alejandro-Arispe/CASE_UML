import { useUmlStore } from '../../store/umlStore';
import type { EditHistoryEntry } from '../../types/history';
import type { ConnectionStatus } from './collaboration';

const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  connected: { label: 'Conectado', dot: 'bg-emerald-500' },
  connecting: { label: 'Conectando...', dot: 'bg-amber-500 animate-pulse motion-reduce:animate-none' },
  disconnected: { label: 'Sin conexion: los cambios no se guardan', dot: 'bg-red-500' },
};

function timeAgo(timestamp: string): string {
  const seconds = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 45) return 'hace un momento';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(timestamp).toLocaleDateString();
}

// Barra de estado inferior: conexion colaborativa, ultimo cambio de
// cualquier integrante y tamano del modelo.
export function StatusBar({
  status,
  lastMovement,
  memberNames,
  onOpenHistory,
}: {
  status: ConnectionStatus;
  lastMovement: EditHistoryEntry | null;
  memberNames: Record<string, string>;
  onOpenHistory: () => void;
}) {
  const classCount = useUmlStore((state) => state.classes.length);
  const relationshipCount = useUmlStore((state) => state.relationships.length);
  const current = STATUS[status];

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-slate-200 bg-white px-3 text-[11px] text-slate-600">
      <span className={`flex shrink-0 items-center gap-1.5 ${status === 'disconnected' ? 'font-medium text-red-700' : ''}`} role="status">
        <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
        {current.label}
      </span>

      <span className="h-3 w-px shrink-0 bg-slate-200" aria-hidden="true" />

      {lastMovement ? (
        <button type="button" onClick={onOpenHistory} className="min-w-0 truncate text-left hover:text-slate-900" title="Ver historial">
          <span className="font-medium text-slate-800">{memberNames[lastMovement.userId] ?? 'Alguien'}</span>{' '}
          {lastMovement.description.charAt(0).toLowerCase() + lastMovement.description.slice(1)}
          <span className="text-slate-500"> · {timeAgo(lastMovement.timestamp)}</span>
        </button>
      ) : (
        <span className="text-slate-500">Sin cambios todavia</span>
      )}

      <span className="ml-auto shrink-0 tabular-nums">
        {classCount} {classCount === 1 ? 'clase' : 'clases'} · {relationshipCount} {relationshipCount === 1 ? 'relacion' : 'relaciones'}
      </span>
    </footer>
  );
}
