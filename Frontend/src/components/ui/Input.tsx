import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// Sin "w-*" aca a proposito: al concatenarse con una clase de ancho pasada
// por props (ej. "w-28"), dos utilities de Tailwind con la misma
// especificidad no se resuelven por orden en el className sino por orden en
// la hoja de estilos generada, asi que un "w-full" fijo en la base puede
// ganarle a un ancho custom del caller de forma impredecible. Cada uso
// decide su ancho explicitamente (normalmente "w-full"). Por el mismo motivo
// el tamano (padding/fuente) se elige con `fieldSize` y no sobreescribiendo clases.
const FIELD_BASE =
  'min-w-0 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 transition-colors hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:bg-slate-100 disabled:text-slate-500';

const FIELD_SIZE = {
  md: 'px-3 py-2 text-sm',
  // Paneles de propiedades: filas densas como en una herramienta CASE.
  sm: 'h-7 px-2 text-[13px]',
};

type FieldSize = keyof typeof FIELD_SIZE;

export function Input({ className = '', fieldSize = 'md', ...props }: InputHTMLAttributes<HTMLInputElement> & { fieldSize?: FieldSize }) {
  return <input className={`${FIELD_BASE} ${FIELD_SIZE[fieldSize]} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_BASE} ${FIELD_SIZE.md} resize-none ${className}`} {...props} />;
}

export function Select({ className = '', fieldSize = 'md', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { fieldSize?: FieldSize }) {
  return <select className={`${FIELD_BASE} ${FIELD_SIZE[fieldSize]} ${fieldSize === 'sm' ? 'pr-6' : ''} ${className}`} {...props} />;
}

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`mb-1 block text-xs font-medium text-slate-600 ${className}`} {...props} />;
}
