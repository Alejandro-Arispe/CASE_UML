import type { ReactNode } from 'react';
import { Card } from './ui/Card';

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          UML
        </div>
        <span className="text-lg font-semibold text-slate-900">CASE_UML</span>
      </div>

      <Card className="w-full max-w-sm px-6 py-7">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

        <div className="mt-6">{children}</div>

        <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
      </Card>
    </div>
  );
}
