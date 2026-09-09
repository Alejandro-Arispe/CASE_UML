import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600 disabled:bg-indigo-300',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:outline-indigo-600 disabled:text-slate-400',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 focus-visible:outline-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:outline-indigo-600',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:shadow-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
