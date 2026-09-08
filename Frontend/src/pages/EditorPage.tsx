import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import type { Connection, EdgeMouseHandler, NodeMouseHandler, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getProjectDetail } from '../services/projectApi';
import { getProjectHistory } from '../services/historyApi';
import type { Project, ProjectMember } from '../types/auth';
import type { EditHistoryEntry } from '../types/history';
import { useUmlStore } from '../store/umlStore';
import { classToNode, relationshipToEdge } from '../features/uml-editor/umlToFlow';
import { ClassNode } from '../features/uml-editor/ClassNode';
import { ClassPanel } from '../features/uml-editor/ClassPanel';
import { RelationshipPanel } from '../features/uml-editor/RelationshipPanel';
import { HistoryPanel } from '../features/uml-editor/HistoryPanel';
import { AiPanel } from '../features/uml-editor/AiPanel';
import { ValidationPanel } from '../features/uml-editor/ValidationPanel';
import * as collaboration from '../features/uml-editor/collaboration';
import type { ConnectionStatus } from '../features/uml-editor/collaboration';

const nodeTypes = { umlClass: ClassNode };

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'En linea',
  connecting: 'Conectando...',
  disconnected: 'Sin conexion (reintentando...)',
};

export function EditorPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [lastMovement, setLastMovement] = useState<EditHistoryEntry | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);
  const selectedClassId = useUmlStore((state) => state.selectedClassId);
  const selectedRelationshipId = useUmlStore((state) => state.selectedRelationshipId);
  const selectClass = useUmlStore((state) => state.selectClass);
  const selectRelationship = useUmlStore((state) => state.selectRelationship);

  // Carga datos que no cambian por Socket.IO (nombre del proyecto, lista de
  // integrantes del proyecto en si, distinta de quien esta conectado ahora).
  useEffect(() => {
    if (!projectId) return;
    getProjectDetail(projectId)
      .then((detail) => {
        setProject(detail.project);
        setMembers(detail.members);
      })
      .catch(() => setError('No se pudo cargar el proyecto (verifica que seas miembro)'));

    // Ultimo movimiento ya existente, para no arrancar en blanco antes de
    // que ocurra el primer cambio en vivo de esta sesion (seccion 27).
    getProjectHistory(projectId, 1).then((entries) => {
      if (entries[0]) setLastMovement(entries[0]);
    });
  }, [projectId]);

  // Conexion de colaboracion en tiempo real (seccion 19-26): une la room del
  // proyecto, sincroniza el modelo al conectar/reconectar y escucha
  // presencia. Se desconecta al salir del editor.
  useEffect(() => {
    if (!projectId) return;
    collaboration.connectToProject(projectId);
    const unsubStatus = collaboration.subscribeConnectionStatus(setStatus);
    const unsubPresence = collaboration.subscribePresence(setOnlineUserIds);
    const unsubHistory = collaboration.subscribeHistory(setLastMovement);
    return () => {
      unsubStatus();
      unsubPresence();
      unsubHistory();
      collaboration.disconnectFromProject();
    };
  }, [projectId]);

  const nodes = useMemo(() => classes.map(classToNode), [classes]);
  const edges = useMemo(() => relationships.map(relationshipToEdge), [relationships]);

  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      collaboration.createRelationship(connection.source, connection.target);
    }
  }, []);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => collaboration.moveClass(node.id, node.position),
    [],
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => selectClass(node.id), [selectClass]);
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => selectRelationship(edge.id),
    [selectRelationship],
  );

  function handleAddClass() {
    const offset = classes.length * 40;
    collaboration.createClass({ x: 80 + offset, y: 80 + offset });
  }

  const memberNames = useMemo(
    () => Object.fromEntries(members.map((m) => [m.userId, m.userName])),
    [members],
  );

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
        <span>{STATUS_LABEL[status]}</span>
        <details>
          <summary>Integrantes ({members.length})</summary>
          <ul>
            {members.map((m) => (
              <li key={m.id}>
                {onlineUserIds.includes(m.userId) ? '● ' : '○ '}
                {m.userName} ({m.role})
              </li>
            ))}
          </ul>
        </details>
        <span>
          {lastMovement
            ? `Ultimo movimiento: ${memberNames[lastMovement.userId] ?? 'Alguien'} - ${lastMovement.description}`
            : 'Sin movimientos todavia'}
        </span>
        <button type="button" onClick={() => setHistoryOpen(true)}>
          Ver historial de edicion
        </button>
        <button type="button" onClick={() => setAiOpen(true)}>
          Asistente IA
        </button>
        <button type="button" onClick={() => setValidationOpen(true)}>
          Validar modelo
        </button>
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

      {historyOpen && projectId && (
        <HistoryPanel projectId={projectId} memberNames={memberNames} onClose={() => setHistoryOpen(false)} />
      )}
      {aiOpen && <AiPanel onClose={() => setAiOpen(false)} />}
      {validationOpen && projectId && (
        <ValidationPanel projectId={projectId} onClose={() => setValidationOpen(false)} />
      )}
    </div>
  );
}
