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
import { AssociationEdge } from '../features/uml-editor/AssociationEdge';
import { ClassPanel } from '../features/uml-editor/ClassPanel';
import { RelationshipPanel } from '../features/uml-editor/RelationshipPanel';
import { HistoryPanel } from '../features/uml-editor/HistoryPanel';
import { AiPanel } from '../features/uml-editor/AiPanel';
import { ValidationPanel } from '../features/uml-editor/ValidationPanel';
import { GeneratorPanel } from '../features/uml-editor/GeneratorPanel';
import { ImportExportControls } from '../features/uml-editor/ImportExportControls';
import * as collaboration from '../features/uml-editor/collaboration';
import type { ConnectionStatus } from '../features/uml-editor/collaboration';
import { Button } from '../components/ui/Button';

const nodeTypes = { umlClass: ClassNode };
const edgeTypes = { association: AssociationEdge };

const STATUS_STYLE: Record<ConnectionStatus, { label: string; dot: string }> = {
  connected: { label: 'En linea', dot: 'bg-emerald-500' },
  connecting: { label: 'Conectando...', dot: 'bg-amber-500' },
  disconnected: { label: 'Sin conexion', dot: 'bg-red-500' },
};

export function EditorPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [lastMovement, setLastMovement] = useState<EditHistoryEntry | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Volver a mis proyectos
        </Link>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[status];

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link to="/projects" className="text-sm text-slate-400 hover:text-slate-600">
          &larr; Mis proyectos
        </Link>
        <span className="text-slate-200">|</span>
        <h1 className="truncate text-sm font-semibold text-slate-900">{project ? project.name : 'Cargando...'}</h1>

        <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          {statusStyle.label}
        </span>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMembersOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <span className="flex -space-x-1.5">
              {members.slice(0, 4).map((m) => (
                <span
                  key={m.id}
                  title={m.userName}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white ${
                    onlineUserIds.includes(m.userId) ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  {m.userName.charAt(0).toUpperCase()}
                </span>
              ))}
            </span>
            {members.length}
          </button>

          {membersOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${onlineUserIds.includes(m.userId) ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    />
                    {m.userName}
                  </span>
                  <span className="text-xs text-slate-400">{m.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setAiOpen(true)}>
            Asistente IA
          </Button>
          <Button size="sm" onClick={() => setHistoryOpen(true)}>
            Historial
          </Button>
          <Button size="sm" onClick={() => setValidationOpen(true)}>
            Validar modelo
          </Button>
          <Button size="sm" variant="primary" onClick={() => setGeneratorOpen(true)}>
            Generar backend
          </Button>
          <Button size="sm" variant="primary" onClick={handleAddClass}>
            + Nueva clase
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-1.5 text-xs text-slate-500">
        {lastMovement ? (
          <span className="truncate">
            <span className="font-medium text-slate-700">{memberNames[lastMovement.userId] ?? 'Alguien'}</span>{' '}
            {lastMovement.description}
          </span>
        ) : (
          <span className="text-slate-400">Sin movimientos todavia</span>
        )}
        <ImportExportControls projectName={project?.name ?? 'modelo'} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onConnect={handleConnect}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={() => {
              selectClass(null);
              selectRelationship(null);
              setMembersOpen(false);
            }}
            fitView
          >
            <Background color="#cbd5e1" gap={20} />
            <Controls />
            <MiniMap pannable zoomable className="!bg-white" />
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
      {generatorOpen && projectId && (
        <GeneratorPanel projectId={projectId} onClose={() => setGeneratorOpen(false)} />
      )}
    </div>
  );
}
