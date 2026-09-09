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
  if (rel) return 'relacion';
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
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-emerald-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">El modelo es valido: no se encontraron problemas.</span>
        </div>
      )}

      {!loading && result && !result.valid && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone="danger">{result.issues.length} problema(s)</Badge>
            <span className="text-sm text-slate-500">El modelo no puede generarse hasta resolverlos.</span>
          </div>
          <ul className="space-y-2">
            {result.issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.elementId}-${index}`} className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-red-500">
                  {issue.elementType} · {elementLabel(issue.elementId)}
                </span>
                <p className="text-sm text-red-700">{issue.message}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
