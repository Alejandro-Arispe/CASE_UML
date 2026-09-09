import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// Sin "w-*" aca a proposito: al concatenarse con una clase de ancho pasada
// por props (ej. "w-28"), dos utilities de Tailwind con la misma
// especificidad no se resuelven por orden en el className sino por orden en
// la hoja de estilos generada, asi que un "w-full" fijo en la base puede
// ganarle a un ancho custom del caller de forma impredecible. Cada uso
// decide su ancho explicitamente (normalmente "w-full").
const FIELD_CLASSES =
  'min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100 disabled:text-slate-400';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASSES} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} resize-none ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${FIELD_CLASSES} ${className}`} {...props} />;
}

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`mb-1 block text-xs font-medium text-slate-600 ${className}`} {...props} />;
}
