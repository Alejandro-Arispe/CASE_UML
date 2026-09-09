import { useEffect, useState } from 'react';
import { getProjectHistory } from '../../services/historyApi';
import type { EditHistoryEntry } from '../../types/history';
import { Modal } from '../../components/ui/Modal';

export function HistoryPanel({
  projectId,
  memberNames,
  onClose,
}: {
  projectId: string;
  memberNames: Record<string, string>;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjectHistory(projectId)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <Modal title="Historial de edicion" onClose={onClose} width="max-w-lg">
      {loading && <p className="text-slate-400">Cargando...</p>}

      {!loading && entries.length === 0 && (
        <p className="text-slate-400">Todavia no hay movimientos registrados.</p>
      )}

      <ul className="space-y-1">
        {entries.map((entry) => {
          const name = memberNames[entry.userId] ?? 'Alguien';
          return (
            <li key={entry.id} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-slate-50">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="text-slate-700">
                  <span className="font-medium text-slate-900">{name}</span> {entry.description}
                </span>
                <span className="block text-xs text-slate-400">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
