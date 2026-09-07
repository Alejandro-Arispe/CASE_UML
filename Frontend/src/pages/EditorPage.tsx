import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import type { Connection, EdgeMouseHandler, NodeMouseHandler, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getProjectDetail } from '../services/projectApi';
import { getUmlModel, saveUmlModel } from '../services/umlApi';
import type { Project, ProjectMember } from '../types/auth';
import { useUmlStore } from '../store/umlStore';
import { classToNode, relationshipToEdge } from '../features/uml-editor/umlToFlow';
import { ClassNode } from '../features/uml-editor/ClassNode';
import { ClassPanel } from '../features/uml-editor/ClassPanel';
import { RelationshipPanel } from '../features/uml-editor/RelationshipPanel';

const nodeTypes = { umlClass: ClassNode };

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function EditorPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);
  const version = useUmlStore((state) => state.version);
  const selectedClassId = useUmlStore((state) => state.selectedClassId);
  const selectedRelationshipId = useUmlStore((state) => state.selectedRelationshipId);
  const loadModel = useUmlStore((state) => state.loadModel);
  const addClass = useUmlStore((state) => state.addClass);
  const addRelationship = useUmlStore((state) => state.addRelationship);
  const moveClass = useUmlStore((state) => state.moveClass);
  const selectClass = useUmlStore((state) => state.selectClass);
  const selectRelationship = useUmlStore((state) => state.selectRelationship);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProjectDetail(projectId), getUmlModel(projectId)])
      .then(([detail, model]) => {
        setProject(detail.project);
        setMembers(detail.members);
        loadModel(projectId, model);
      })
      .catch(() => setError('No se pudo cargar el proyecto (verifica que seas miembro)'));
  }, [projectId, loadModel]);

  // Autoguardado con debounce (seccion 24): no hay boton "Guardar", cada
  // cambio programa un PUT del grafo completo tras un breve silencio.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectId || version === 0) return;

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveUmlModel(projectId, classes, relationships)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'));
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, projectId]);

  const nodes = useMemo(() => classes.map(classToNode), [classes]);
  const edges = useMemo(() => relationships.map(relationshipToEdge), [relationships]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addRelationship(connection.source, connection.target);
      }
    },
    [addRelationship],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => moveClass(node.id, node.position),
    [moveClass],
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => selectClass(node.id), [selectClass]);
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => selectRelationship(edge.id),
    [selectRelationship],
  );

  function handleAddClass() {
    const offset = classes.length * 40;
    addClass({ x: 80 + offset, y: 80 + offset });
  }

  if (error) {
    return (
      <div>
        <p role="alert">{error}</p>
        <Link to="/projects">Volver a mis proyectos</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 8, borderBottom: '1px solid #ddd' }}>
        <Link to="/projects">Mis proyectos</Link>
        <h1 style={{ fontSize: 18, margin: 0 }}>{project ? project.name : 'Cargando...'}</h1>
        <button type="button" onClick={handleAddClass}>
          + Nueva clase
        </button>
        <span>
          {saveStatus === 'saving' && 'Guardando...'}
          {saveStatus === 'saved' && 'Guardado'}
          {saveStatus === 'error' && 'Error al guardar'}
        </span>
        <details>
          <summary>Integrantes ({members.length})</summary>
          <ul>
            {members.map((m) => (
              <li key={m.id}>
                {m.userName} ({m.role})
              </li>
            ))}
          </ul>
        </details>
      </header>

      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onConnect={handleConnect}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={() => {
              selectClass(null);
              selectRelationship(null);
            }}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {selectedClassId && <ClassPanel classId={selectedClassId} />}
        {selectedRelationshipId && <RelationshipPanel relationshipId={selectedRelationshipId} />}
      </div>
    </div>
  );
}
