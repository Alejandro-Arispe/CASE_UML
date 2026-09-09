import { useState } from 'react';
import type { FormEvent } from 'react';
import * as collaboration from './collaboration';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';

// Panel de IA (secciones 28-30): el usuario describe en lenguaje natural
// que quiere y la IA produce comandos estructurados que el backend valida
// y aplica con el mismo motor de operaciones del editor manual. Aca no se
// toca el modelo directamente: solo se manda el prompt y se espera el
// resultado (los cambios llegan como eventos normales de colaboracion).
export function AiPanel({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setFeedback(null);
    const result = await collaboration.sendAiPrompt(prompt.trim());
    setLoading(false);

    if (!result.ok) {
      setFeedback({ tone: 'error', text: result.error ?? 'No se pudo procesar el pedido' });
      return;
    }

    const skippedCount = result.skipped?.length ?? 0;
    setFeedback({
      tone: 'ok',
      text:
        `Se aplicaron ${result.applied ?? 0} cambios.` +
        (skippedCount > 0 ? ` ${skippedCount} comando(s) omitidos: ${result.skipped!.map((s) => s.reason).join('; ')}` : ''),
    });
    setPrompt('');
  }

  return (
    <aside className="fixed bottom-4 right-4 z-40 flex w-80 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 bg-indigo-600 px-4 py-2.5">
        <span className="text-sm font-semibold text-white">Asistente IA</span>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-indigo-100 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 p-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='Ej: "Crea un sistema basico de biblioteca con libros, autores, usuarios y prestamos" o "Agrega telefono a Cliente"'
          rows={4}
          className="w-full"
        />
        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? 'Pensando...' : 'Enviar'}
        </Button>
      </form>

      {feedback && (
        <p
          className={`px-3 pb-3 text-xs ${feedback.tone === 'error' ? 'text-red-600' : 'text-slate-500'}`}
        >
          {feedback.text}
        </p>
      )}
    </aside>
  );
}
