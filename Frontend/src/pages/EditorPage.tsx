import { useParams } from 'react-router-dom';

export function EditorPage() {
  const { projectId } = useParams();

  return (
    <div>
      <h1>Editor UML</h1>
      <p>Proyecto: {projectId} (editor con React Flow en Fase 5).</p>
    </div>
  );
}
