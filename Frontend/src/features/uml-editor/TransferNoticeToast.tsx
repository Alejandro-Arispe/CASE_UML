import { useEffect } from 'react';
import { IconAlert, IconCheckCircle, IconX } from '../../components/ui/icons';
import type { TransferNotice } from './useXmiTransfer';

const TONE = {
  ok: { box: 'border-emerald-200', icon: 'text-emerald-600' },
  warning: { box: 'border-amber-200', icon: 'text-amber-600' },
  error: { box: 'border-red-200', icon: 'text-red-600' },
};

// Aviso flotante del resultado de importar/exportar. Los exitos sin detalles
// se cierran solos; errores y advertencias quedan hasta que el usuario los lee.
export function TransferNoticeToast({ notice, onDismiss }: { notice: TransferNotice | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice || notice.tone !== 'ok' || notice.details?.length) return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  const tone = TONE[notice.tone];

  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`absolute bottom-4 left-1/2 z-30 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border bg-white px-3 py-2.5 shadow-lg ${tone.box}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 ${tone.icon}`}>{notice.tone === 'ok' ? <IconCheckCircle /> : <IconAlert />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-slate-900">{notice.text}</p>
          {notice.details && notice.details.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
              {notice.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
