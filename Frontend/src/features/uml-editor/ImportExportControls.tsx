import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { exportToXmi, parseXmiToModel } from './xmiFormat';
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

// Exportar/importar el modelo UML como XMI (seccion "Import/Export"): es el
// formato estandar de intercambio UML entre herramientas CASE, no un volcado
// JSON propio. La conversion XMI <-> classes/relationships vive en
// xmiFormat.ts; aca solo se arma/lee el archivo.
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
    const xmi = exportToXmi(classes, relationships, projectName);
    const blob = new Blob([xmi], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(projectName)}.xmi`;
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
      const parsed = parseXmiToModel(await file.text());
      const result = await collaboration.importModel(parsed.classes, parsed.relationships);
      if (result.ok) {
        showStatus('ok', 'Modelo importado correctamente.');
      } else {
        showStatus('error', result.error ?? 'No se pudo importar el modelo.');
      }
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'El archivo no es un XMI valido.');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleExport} title="Exportar el modelo como XMI">
        Exportar
      </Button>
      <Button size="sm" onClick={() => fileInputRef.current?.click()} title="Importar un modelo desde XMI">
        Importar
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xmi,application/xml,text/xml"
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
