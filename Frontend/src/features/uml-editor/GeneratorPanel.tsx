import { useState } from 'react';
import axios from 'axios';
import { generateBackend, parseErrorBlob } from '../../services/generatorApi';
import type { GeneratedBackendDownload } from '../../services/generatorApi';
import type { ValidationIssue } from '../../types/validation';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Dispara el generador Spring Boot (secciones 31-42). El backend ya valida
// el modelo antes de generar (seccion 17); si no es valido, devuelve la
// misma lista de issues que "Validar modelo" en vez de generar en silencio.
// El backend generado no queda en el servidor: esta pantalla recibe
// directamente el .zip y lo baja al navegador.
export function GeneratorPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedBackendDownload | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setIssues(null);
    try {
      const data = await generateBackend(projectId);
      setResult(data);
      triggerBrowserDownload(data.blob, data.filename);
    } catch (err) {
      const parsed = axios.isAxiosError(err) ? await parseErrorBlob(err.response?.data) : null;
      if (parsed?.issues) {
        setIssues(parsed.issues as ValidationIssue[]);
      } else {
        setError(parsed?.error ?? 'No se pudo generar el backend');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Generar backend Spring Boot"
      onClose={onClose}
      width="max-w-lg"
      footer={
        !confirmed && !result ? (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={() => setConfirmed(true)}>
              Si, generar
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Cerrar</Button>
        )
      }
    >
      {!confirmed && !result && (
        <p className="text-slate-600">
          Esto genera un backend Spring Boot a partir del modelo UML actual y lo descarga como .zip, listo para
          descomprimir y ejecutar aparte. No queda nada guardado en el servidor. ¿Continuar?
        </p>
      )}

      {confirmed && !result && (
        <div className="space-y-3">
          <Button variant="primary" onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? 'Generando...' : 'Generar y descargar'}
          </Button>

          {issues && (
            <div>
              <p className="text-sm text-slate-600">El modelo no es valido. Resolve estos problemas y volve a intentar:</p>
              <ul className="mt-2 space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                    [{issue.elementType}] {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
            Backend generado: la descarga de {result.filename} deberia haber empezado.
          </div>

          <dl className="grid grid-cols-3 gap-x-2 gap-y-2 text-sm">
            <dt className="text-slate-400">Paquete</dt>
            <dd className="col-span-2 font-mono text-xs text-slate-700">{result.packageName}</dd>
            <dt className="text-slate-400">Base de datos</dt>
            <dd className="col-span-2 font-mono text-xs text-slate-700">
              {result.databaseName} ({result.dbHost}:{result.dbPort})
            </dd>
            <dt className="text-slate-400">Puerto</dt>
            <dd className="col-span-2 text-slate-700">{result.port}</dd>
          </dl>

          <div>
            <p className="mb-1 text-sm text-slate-600">Para ejecutarlo:</p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2.5 text-xs text-slate-100">
              {`unzip ${result.filename}\ncd ${result.filename.replace(/\.zip$/, '')}\nmvn spring-boot:run`}
            </pre>
          </div>

          <p className="text-sm text-slate-600">
            Luego abrir Swagger en{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              http://localhost:{result.port}/swagger-ui.html
            </code>
          </p>

          <Button onClick={() => triggerBrowserDownload(result.blob, result.filename)} className="w-full">
            Descargar de nuevo
          </Button>
        </div>
      )}
    </Modal>
  );
}
