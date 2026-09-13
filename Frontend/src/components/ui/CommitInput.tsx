import { useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Input } from './Input';

interface CommitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  // Se llama al salir del campo o con Enter, solo si el valor cambio y no
  // quedo vacio (un nombre vacio lo rechaza el servidor).
  onCommit: (value: string) => void;
  allowEmpty?: boolean;
  fieldSize?: 'sm' | 'md';
}

// Campo de texto que confirma al terminar de escribir, no en cada tecla:
// antes cada tecla era una operacion colaborativa (y una entrada de
// historial), y borrar todo el texto para reescribirlo hacia que el
// servidor rechazara el nombre vacio y el campo "saltara".
export function CommitInput({ value, onCommit, allowEmpty = false, ...props }: CommitInputProps) {
  // Borrador local solo mientras se edita; si no, se muestra el valor del
  // modelo (asi se ven los cambios que haga otro usuario).
  const [draft, setDraft] = useState<string | null>(null);
  // El blur que dispara Escape/Enter llega con el `draft` de este render:
  // esta marca evita confirmar dos veces o confirmar lo cancelado.
  const handledRef = useRef(false);

  function commit() {
    if (handledRef.current) {
      handledRef.current = false;
      return;
    }
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    if ((!trimmed && !allowEmpty) || trimmed === value) return;
    onCommit(trimmed);
  }

  return (
    <Input
      {...props}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          handledRef.current = true;
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(null);
          handledRef.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
