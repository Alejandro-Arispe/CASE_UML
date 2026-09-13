import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';
import { decodeXmiFile, exportToXmi, parseXmiToModel } from './xmiFormat';

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

export type TransferNotice = { tone: 'ok' | 'error' | 'warning'; text: string; details?: string[] };

// Exportar/importar el modelo UML como XMI compatible con Enterprise
// Architect. La conversion XMI <-> classes/relationships vive en
// xmiFormat.ts; este hook arma/lee el archivo y expone el resultado para que
// la barra de herramientas y el aviso flotante lo muestren.
export function useXmiTransfer(projectName: string) {
  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<TransferNotice | null>(null);
  const [importing, setImporting] = useState(false);
  // Estable entre renders: el aviso programa su cierre automatico con ella.
  const dismissNotice = useCallback(() => setNotice(null), []);

  function exportXmi() {
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
    setNotice({ tone: 'ok', text: `Exportado ${slugify(projectName)}.xmi (${classes.length} clases)` });
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const parsed = parseXmiToModel(decodeXmiFile(await file.arrayBuffer()));

      if (
        classes.length > 0 &&
        !window.confirm(
          `Importar "${file.name}" reemplaza el diagrama actual (${classes.length} clases) para todos los integrantes. ¿Continuar?`,
        )
      ) {
        return;
      }

      setImporting(true);
      const result = await collaboration.importModel(parsed.classes, parsed.relationships);
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error ?? 'No se pudo importar el modelo.' });
        return;
      }
      setNotice({
        tone: parsed.warnings.length ? 'warning' : 'ok',
        text: `Importado "${file.name}": ${parsed.classes.length} clases y ${parsed.relationships.length} relaciones`,
        details: parsed.warnings,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'El archivo no es un XMI valido.' });
    } finally {
      setImporting(false);
    }
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".xmi,.xml,application/xml,text/xml"
      className="hidden"
      onChange={handleImportFile}
    />
  );

  return {
    exportXmi,
    openImport: () => fileInputRef.current?.click(),
    importing,
    canExport: classes.length > 0,
    fileInput,
    notice,
    dismissNotice,
  };
}
