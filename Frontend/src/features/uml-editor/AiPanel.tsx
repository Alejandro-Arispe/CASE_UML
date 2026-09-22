import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import * as collaboration from './collaboration';
import { DIAGRAM_FILE_ACCEPT, prepareDiagramFile } from './imageUpload';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useLocalSpeechRecognition } from './useLocalSpeechRecognition';
import { ToolButton } from '../../components/ui/IconButton';
import { IconAlert, IconCheckCircle, IconImage, IconMic, IconSend, IconSparkles, IconX } from '../../components/ui/icons';

const EXAMPLES = [
  'Sistema de ventas para una ferreteria con clientes, productos, categorias, proveedores, ventas y detalle de venta',
  'Sistema de reservas de un hotel con habitaciones, tipos de habitacion, huespedes, reservas y pagos',
  'Agrega a Cliente un telefono opcional y una fecha de registro obligatoria',
];

type Feedback = { tone: 'ok' | 'error'; text: string; skipped?: string[] };

// Panel de IA (secciones 28-30): el usuario describe lo que quiere (escrito
// o dictado por voz) o sube una foto/captura/PDF de un diagrama, y la IA
// produce comandos estructurados que el backend valida y aplica con el mismo
// motor de operaciones del editor manual. El resultado llega a todos los
// integrantes como un reemplazo del modelo.
export function AiPanel({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState<null | 'text' | 'file'>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appendDictation = useCallback(
    (text: string) => setPrompt((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text)),
    [],
  );
  const speech = useSpeechRecognition(appendDictation);
  const localSpeech = useLocalSpeechRecognition(appendDictation);

  function applyResult(result: collaboration.AiCommandResult) {
    if (!result.ok) {
      setFeedback({ tone: 'error', text: result.error ?? 'No se pudo procesar el pedido' });
      return false;
    }
    const skipped = result.skipped?.map((s) => s.reason) ?? [];
    setFeedback({
      tone: 'ok',
      text: result.applied ? `Se aplicaron ${result.applied} cambios al diagrama.` : 'La IA no encontro cambios para aplicar.',
      skipped,
    });
    return true;
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;
    speech.stop();
    localSpeech.stop();

    setLoading('text');
    setFeedback(null);
    const result = await collaboration.sendAiPrompt(prompt.trim());
    setLoading(null);
    if (applyResult(result)) setPrompt('');
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || loading) return;
    speech.stop();
    localSpeech.stop();

    setLoading('file');
    setFeedback(null);
    try {
      const { base64, mimeType } = await prepareDiagramFile(file);
      // Si hay texto escrito, viaja como indicaciones para interpretar el archivo.
      const result = await collaboration.sendAiFile(base64, mimeType, prompt.trim() || undefined);
      if (applyResult(result)) setPrompt('');
    } catch (err) {
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo leer el archivo' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <section
      aria-label="Asistente IA"
      className="absolute bottom-4 right-4 z-30 flex max-h-[calc(100%-2rem)] w-[380px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      <header className="flex items-start gap-2.5 border-b border-slate-100 px-3 py-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white">
          <IconSparkles size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-slate-900">Asistente IA</h2>
          <p className="text-xs text-slate-600">Disena o modifica el modelo con texto, voz o una imagen.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar asistente"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <IconX size={15} />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 overflow-y-auto p-3">
        <div
          className={`rounded-md border transition-colors focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/25 ${
            speech.listening ? 'border-red-300 bg-red-50/40' : 'border-slate-300'
          }`}
        >
          <textarea
            value={speech.interim ? `${prompt} ${speech.interim}`.trim() : prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
            }}
            readOnly={speech.listening}
            aria-label="Pedido para la IA"
            placeholder="Describe el sistema o el cambio que necesitas..."
            rows={4}
            className="block w-full resize-none bg-transparent px-3 pt-2 text-[13px] leading-relaxed text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
          <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
            <ToolButton
              label={speech.supported ? (speech.listening ? 'Detener dictado' : 'Dictar por voz') : 'Dictado no disponible (usa Chrome o Edge)'}
              icon={<IconMic size={15} />}
              active={speech.listening}
              disabled={Boolean(loading) || !speech.supported}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              tooltipSide="top"
              tooltipAlign="start"
              className={speech.listening ? '!bg-red-50 !text-red-700 !ring-red-200' : ''}
            />
            <ToolButton
              label={
                localSpeech.available
                  ? localSpeech.recording
                    ? 'Detener dictado local'
                    : localSpeech.transcribing
                      ? 'Transcribiendo localmente...'
                      : 'Dictar localmente (Whisper)'
                  : 'Whisper local no esta iniciado'
              }
              icon={<IconMic size={15} />}
              active={localSpeech.recording || localSpeech.transcribing}
              disabled={Boolean(loading) || !localSpeech.available || localSpeech.transcribing}
              onClick={() => (localSpeech.recording ? localSpeech.stop() : localSpeech.start())}
              tooltipSide="top"
              tooltipAlign="start"
              className={localSpeech.recording ? '!bg-violet-50 !text-violet-700 !ring-violet-200' : ''}
            />
            <ToolButton
              label="Subir foto, captura o PDF de un diagrama"
              icon={<IconImage size={15} />}
              disabled={Boolean(loading)}
              onClick={() => fileInputRef.current?.click()}
              tooltipSide="top"
              tooltipAlign="start"
            />
            {speech.listening && (
              <span className="ml-1 flex items-center gap-1.5 text-[11px] font-medium text-red-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
                Escuchando
              </span>
            )}
            <button
              type="submit"
              disabled={Boolean(loading) || !prompt.trim()}
              className="ml-auto flex h-7 items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {loading === 'text' ? 'Disenando...' : 'Enviar'}
              <IconSend size={13} />
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept={DIAGRAM_FILE_ACCEPT} className="hidden" onChange={handleFileChange} />

        {!prompt && !loading && !feedback && (
          <div>
            <p className="mb-1 text-[11px] text-slate-500">Ejemplos</p>
            <div className="flex flex-col gap-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="truncate rounded-md border border-slate-200 px-2 py-1.5 text-left text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  title={example}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {speech.error && <p className="text-xs text-red-700">{speech.error}</p>}
        {localSpeech.error && <p className="text-xs text-red-700">{localSpeech.error}</p>}

        {loading && (
          <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700" role="status">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 motion-reduce:animate-none" />
            {loading === 'file' ? 'Reconociendo el diagrama...' : 'Disenando el modelo, puede tardar unos segundos...'}
          </div>
        )}

        {feedback && (
          <div
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-md px-2.5 py-2 text-xs ${feedback.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}
          >
            <p className="flex items-center gap-1.5">
              {feedback.tone === 'error' ? <IconAlert size={14} /> : <IconCheckCircle size={14} />}
              {feedback.text}
            </p>
            {feedback.skipped && feedback.skipped.length > 0 && (
              <details className="mt-1 text-amber-800">
                <summary className="cursor-pointer">{feedback.skipped.length} comando(s) omitidos</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {feedback.skipped.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-500">Ctrl+Enter para enviar · Los cambios los ven todos los integrantes.</p>
      </form>
    </section>
  );
}
