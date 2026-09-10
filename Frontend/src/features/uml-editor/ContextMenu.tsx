interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

// Menu contextual generico (clic derecho en el canvas, una clase o una
// relacion). Un overlay invisible detras cierra el menu al clickear afuera
// o al volver a hacer clic derecho en otro lado.
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
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
        className="fixed z-50 min-w-[170px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        style={{ left: x, top: y }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
              item.danger ? 'text-red-600' : 'text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
