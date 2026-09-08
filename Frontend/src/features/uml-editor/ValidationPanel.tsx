import { useEffect, useState } from 'react';
import { validateProject } from '../../services/validationApi';
import { useUmlStore } from '../../store/umlStore';
import type { ValidationResult } from '../../types/validation';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', padding: 16, minWidth: 360, maxHeight: '70vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Validacion del modelo</h2>
        {loading && <p>Validando...</p>}

        {!loading && result?.valid && <p>El modelo es valido: no se encontraron problemas.</p>}

        {!loading && result && !result.valid && (
          <>
            <p>Se encontraron {result.issues.length} problema(s). El modelo no puede generarse hasta resolverlos:</p>
            <ul>
              {result.issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.elementId}-${index}`}>
                  [{issue.elementType}: {elementLabel(issue.elementId)}] {issue.message}
                </li>
              ))}
            </ul>
          </>
        )}

        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
