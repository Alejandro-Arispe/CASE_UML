import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ToolButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  // Texto del tooltip y nombre accesible.
  label: string;
  // Atajo de teclado mostrado en el tooltip (ej. "Supr").
  shortcut?: string;
  icon: ReactNode;
  // Texto visible al lado del icono (si no, el boton es solo icono).
  text?: string;
  active?: boolean;
  tooltipSide?: 'bottom' | 'top';
  // Desde que ancho de pantalla se muestra `text` (en pantallas angostas el
  // boton queda solo con icono y el tooltip).
  textFrom?: 'always' | 'lg' | 'xl' | '2xl';
  // Alineacion del tooltip (en los extremos de la pantalla, para no cortarse).
  tooltipAlign?: 'center' | 'start' | 'end';
}

const TOOLTIP_ALIGN = { center: 'left-1/2 -translate-x-1/2', start: 'left-0', end: 'right-0' };

const TEXT_VISIBILITY = { always: 'inline', lg: 'hidden lg:inline', xl: 'hidden xl:inline', '2xl': 'hidden 2xl:inline' };

// Boton de barra de herramientas: icono (+ texto opcional) con tooltip propio.
// El `title` nativo tarda ~1s en aparecer y no muestra atajos; este aparece
// al instante con hover o foco de teclado.
export function ToolButton({
  label,
  shortcut,
  icon,
  text,
  active = false,
  tooltipSide = 'bottom',
  textFrom = 'always',
  tooltipAlign = 'center',
  className = '',
  ...props
}: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`group/tool relative inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 ${
        text ? 'px-2' : ''
      } ${active ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'} ${className}`}
      {...props}
    >
      {icon}
      {text && <span className={TEXT_VISIBILITY[textFrom]}>{text}</span>}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${TOOLTIP_ALIGN[tooltipAlign]} z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition-opacity delay-0 group-hover/tool:opacity-100 group-hover/tool:delay-300 group-focus-visible/tool:opacity-100 ${
          tooltipSide === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
        }`}
      >
        {label}
        {shortcut && <kbd className="ml-1.5 rounded bg-white/15 px-1 font-sans text-[10px] text-slate-200">{shortcut}</kbd>}
      </span>
    </button>
  );
}

export function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />;
}
