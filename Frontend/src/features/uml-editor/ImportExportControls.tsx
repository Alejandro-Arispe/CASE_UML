import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { Button } from '../../components/ui/Button';

const ACCENT_MARKS_REGEX = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(ACCENT_MARKS_REGEX, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'modelo'
  );
}

// Exportar/importar el modelo UML como JSON. Reutiliza exactamente la misma
// forma que usa el resto del sistema (classes/relationships), asi un
// archivo exportado desde un proyecto se puede importar en otro.
export function ImportExportControls({ projectName }: { projectName: string }) {
  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function showStatus(tone: 'ok' | 'error', text: string) {
    setStatus({ tone, text });
    setTimeout(() => setStatus(null), 4000);
  }

  function handleExport() {
    const data = { classes, relationships };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(projectName)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.classes) || !Array.isArray(parsed.relationships)) {
        throw new Error('El archivo debe tener "classes" y "relationships".');
      }
      const result = await collaboration.importModel(parsed.classes, parsed.relationships);
      if (result.ok) {
        showStatus('ok', 'Modelo importado correctamente.');
      } else {
        showStatus('error', result.error ?? 'No se pudo importar el modelo.');
      }
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'El archivo no es un JSON valido.');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleExport}>
        Exportar
      </Button>
      <Button size="sm" onClick={() => fileInputRef.current?.click()}>
        Importar
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />
      {status && (
        <span className={`text-xs ${status.tone === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
          {status.text}
        </span>
      )}
    </div>
  );
}
