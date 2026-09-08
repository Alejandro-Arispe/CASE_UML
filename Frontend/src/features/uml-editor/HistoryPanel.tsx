import { useEffect, useState } from 'react';
import { getProjectHistory } from '../../services/historyApi';
import type { EditHistoryEntry } from '../../types/history';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', padding: 16, minWidth: 360, maxHeight: '70vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Historial de edicion</h2>
        {loading && <p>Cargando...</p>}
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{new Date(entry.timestamp).toLocaleTimeString()}</strong>{' '}
              {memberNames[entry.userId] ?? 'Alguien'} — {entry.description}
            </li>
          ))}
          {!loading && entries.length === 0 && <li>Todavia no hay movimientos registrados.</li>}
        </ul>
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
