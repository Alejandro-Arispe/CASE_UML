import { useState } from 'react';
import type { FormEvent } from 'react';
import * as collaboration from './collaboration';

// Panel de IA (secciones 28-30): el usuario describe en lenguaje natural
// que quiere y la IA produce comandos estructurados que el backend valida
// y aplica con el mismo motor de operaciones del editor manual. Aca no se
// toca el modelo directamente: solo se manda el prompt y se espera el
// resultado (los cambios llegan como eventos normales de colaboracion).
export function AiPanel({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setFeedback(null);
    const result = await collaboration.sendAiPrompt(prompt.trim());
    setLoading(false);

    if (!result.ok) {
      setFeedback(`Error: ${result.error}`);
      return;
    }

    const skippedCount = result.skipped?.length ?? 0;
    setFeedback(
      `Se aplicaron ${result.applied ?? 0} cambios.` +
        (skippedCount > 0 ? ` ${skippedCount} comando(s) omitidos: ${result.skipped!.map((s) => s.reason).join('; ')}` : ''),
    );
    setPrompt('');
  }

  return (
    <aside style={{ position: 'fixed', right: 16, bottom: 16, width: 320, background: '#fff', border: '1px solid #ccc', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Asistente IA</h3>
        <button type="button" onClick={onClose}>
          x
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='Ej: "Crea un sistema basico de biblioteca con libros, autores, usuarios y prestamos" o "Agrega telefono a Cliente"'
          rows={4}
          style={{ width: '100%' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Pensando...' : 'Enviar'}
        </button>
      </form>
      {feedback && <p>{feedback}</p>}
    </aside>
  );
}
