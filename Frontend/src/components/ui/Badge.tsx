import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  accent: 'bg-indigo-100 text-indigo-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
