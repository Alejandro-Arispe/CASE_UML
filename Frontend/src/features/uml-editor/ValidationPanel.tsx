import { useEffect, useState } from 'react';
import { validateProject } from '../../services/validationApi';
import { useUmlStore } from '../../store/umlStore';
import type { ValidationResult } from '../../types/validation';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

// Resuelve un elementId a algo legible para mostrar junto al mensaje del
// issue (el mensaje del backend ya suele incluir el nombre, esto es un
// respaldo para los casos en que no, ej. clase sin nombre).
function elementLabel(issueElementId: string): string {
  const state = useUmlStore.getState();
  const klass = state.classes.find((c) => c.id === issueElementId);
  if (klass) return klass.name || '(sin nombre)';
  const rel = state.relationships.find((r) => r.id === issueElementId);
  if (rel) {
    const nameOf = (id: string) => state.classes.find((c) => c.id === id)?.name ?? '?';
    return `relacion ${nameOf(rel.sourceClassId)} - ${nameOf(rel.targetClassId)}`;
  }
  for (const c of state.classes) {
    const attr = c.attributes.find((a) => a.id === issueElementId);
    if (attr) return `${c.name}.${attr.name || '(sin nombre)'}`;
  }
  return issueElementId;
}

export function ValidationPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validateProject(projectId)
      .then(setResult)
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <Modal title="Validacion del modelo" onClose={onClose}>
      {loading && <p className="text-slate-400">Validando...</p>}

      {!loading && result?.valid && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-emerald-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">
            {result.issues.length === 0
              ? 'El modelo es valido: no se encontraron problemas.'
              : 'El modelo es valido y se puede generar (revisa las advertencias).'}
          </span>
        </div>
      )}

      {!loading && result && result.issues.length > 0 && (
        <>
          {!result.valid && (
            <div className="mb-3 flex items-center gap-2">
              <Badge tone="danger">{result.issues.filter((i) => i.severity === 'ERROR').length} error(es)</Badge>
              <span className="text-sm text-slate-500">El modelo no puede generarse hasta resolverlos.</span>
            </div>
          )}
          <ul className="space-y-2">
            {[...result.issues]
              .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'ERROR' ? -1 : 1))
              .map((issue, index) => {
                const isError = issue.severity === 'ERROR';
                return (
                  <li
                    key={`${issue.code}-${issue.elementId}-${index}`}
                    className={`rounded-md border px-3 py-2 ${isError ? 'border-red-100 bg-red-50' : 'border-amber-100 bg-amber-50'}`}
                  >
                    <span className={`text-xs font-medium uppercase tracking-wide ${isError ? 'text-red-500' : 'text-amber-600'}`}>
                      {isError ? 'Error' : 'Advertencia'} · {elementLabel(issue.elementId)}
                    </span>
                    <p className={`text-sm ${isError ? 'text-red-700' : 'text-amber-800'}`}>{issue.message}</p>
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </Modal>
  );
}
