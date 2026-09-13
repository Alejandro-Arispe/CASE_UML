import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  // Dibuja una linea separadora antes de este item.
  separatorBefore?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
  onClose: () => void;
}

// Menu contextual generico (clic derecho en el canvas, una clase o una
// relacion). Se reposiciona para no salirse de la ventana y se cierra con
// clic afuera o Escape.
export function ContextMenu({ x, y, title, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.min(x, window.innerWidth - width - 8),
      top: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-50 min-w-[200px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        style={position}
      >
        {title && <p className="truncate px-2 pb-1 pt-0.5 text-[11px] font-medium text-slate-500">{title}</p>}
        {items.map((item) => (
          <div key={item.label}>
            {item.separatorBefore && <div className="my-1 h-px bg-slate-100" />}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none focus-visible:bg-slate-100 ${
                item.danger ? 'text-red-700 hover:bg-red-50 focus-visible:bg-red-50' : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span className={`flex w-4 justify-center ${item.danger ? 'text-red-600' : 'text-slate-500'}`}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.shortcut && <kbd className="font-sans text-[11px] text-slate-500">{item.shortcut}</kbd>}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
