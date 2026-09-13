import type { ReactNode } from 'react';
import { IconClass, IconSparkles, IconUpload } from '../../components/ui/icons';

function Option({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-indigo-600">
        {icon}
      </span>
      <span>
        <span className="block text-[13px] font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-600">{description}</span>
      </span>
    </button>
  );
}

// Primer uso de un proyecto: en vez de un canvas en blanco, las tres formas
// de empezar un diagrama.
export function CanvasEmptyState({
  onAddClass,
  onImport,
  onOpenAi,
}: {
  onAddClass: () => void;
  onImport: () => void;
  onOpenAi: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="pointer-events-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <div className="px-3 pb-2 pt-2">
          <h2 className="text-sm font-semibold text-slate-900">El diagrama esta vacio</h2>
          <p className="mt-0.5 text-xs text-slate-600">Elige como empezar el modelo de datos de este proyecto.</p>
        </div>
        <Option icon={<IconClass />} title="Crear una clase" description="Empieza a modelar a mano, clase por clase." onClick={onAddClass} />
        <Option
          icon={<IconSparkles />}
          title="Generar con el asistente IA"
          description="Describe el sistema por texto o voz, o sube una foto del diagrama."
          onClick={onOpenAi}
        />
        <Option
          icon={<IconUpload />}
          title="Importar un XMI"
          description="Trae un diagrama de Enterprise Architect u otra herramienta UML."
          onClick={onImport}
        />
      </div>
    </div>
  );
}
