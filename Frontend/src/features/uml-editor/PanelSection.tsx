import type { ReactNode } from 'react';

// Seccion de un panel lateral: titulo en caja normal (no mayusculas
// espaciadas) con accion opcional a la derecha, como en los inspectores de
// herramientas de escritorio.
export function PanelSection({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-slate-100 px-3 py-3 ${className}`}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
