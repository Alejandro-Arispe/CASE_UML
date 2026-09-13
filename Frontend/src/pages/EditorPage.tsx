import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import type { Connection, Edge, EdgeMouseHandler, Node, NodeChange, NodeMouseHandler, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getProjectDetail } from '../services/projectApi';
import { getProjectHistory } from '../services/historyApi';
import type { Project, ProjectMember } from '../types/auth';
import type { EditHistoryEntry } from '../types/history';
import type { RelationshipKind } from '../types/uml';
import { useUmlStore } from '../store/umlStore';
import { classToNode, relationshipsToEdges } from '../features/uml-editor/umlToFlow';
import { computeDagreLayout } from '../features/uml-editor/autoLayout';
import { ClassNode } from '../features/uml-editor/ClassNode';
import { UmlEdge } from '../features/uml-editor/UmlEdge';
import { HistoryPanel } from '../features/uml-editor/HistoryPanel';
import { AiPanel } from '../features/uml-editor/AiPanel';
import { ValidationPanel } from '../features/uml-editor/ValidationPanel';
import { GeneratorPanel } from '../features/uml-editor/GeneratorPanel';
import { AlignmentToolbar } from '../features/uml-editor/AlignmentToolbar';
import { ContextMenu } from '../features/uml-editor/ContextMenu';
import type { ContextMenuItem } from '../features/uml-editor/ContextMenu';
import { EditorTopBar } from '../features/uml-editor/EditorTopBar';
import { EditorToolbar } from '../features/uml-editor/EditorToolbar';
import { ModelExplorer } from '../features/uml-editor/ModelExplorer';
import { PropertiesPanel } from '../features/uml-editor/PropertiesPanel';
import { StatusBar } from '../features/uml-editor/StatusBar';
import { CanvasEmptyState } from '../features/uml-editor/CanvasEmptyState';
import { TransferNoticeToast } from '../features/uml-editor/TransferNoticeToast';
import { useXmiTransfer } from '../features/uml-editor/useXmiTransfer';
import * as collaboration from '../features/uml-editor/collaboration';
import type { ConnectionStatus } from '../features/uml-editor/collaboration';
import { IconClass, IconCopy, IconFit, IconSwap, IconTrash } from '../components/ui/icons';

const nodeTypes = { umlClass: ClassNode };
const edgeTypes = { uml: UmlEdge };
const GRID_SIZE: [number, number] = [16, 16];
const CANVAS_BG = '#f5f6f8';

type MenuTarget =
  | { kind: 'pane'; flowPosition: { x: number; y: number } }
  | { kind: 'node'; classId: string }
  | { kind: 'edge'; relationshipId: string };

interface ContextMenuState {
  x: number;
  y: number;
  target: MenuTarget;
}

// Preferencia de paneles visibles por navegador (no se comparte entre
// integrantes: es comodidad personal).
function usePanelPreference(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === '1';
    } catch {
      return initial;
    }
  });
  const toggle = useCallback(() => {
    setValue((current) => {
      try {
        localStorage.setItem(key, current ? '0' : '1');
      } catch {
        // Almacenamiento no disponible: la preferencia vive solo en memoria.
      }
      return !current;
    });
  }, [key]);
  return [value, toggle] as const;
}

// EditorPage necesita useReactFlow() (auto-layout, zoom, centrar en una
// clase, click derecho -> posicion real del diagrama), y ese hook solo
// funciona dentro de un <ReactFlowProvider>.
export function EditorPage() {
  return (
    <ReactFlowProvider>
      <EditorPageInner />
    </ReactFlowProvider>
  );
}

function EditorPageInner() {
  const { projectId } = useParams();
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, setCenter, getNode, getZoom } = useReactFlow();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [lastMovement, setLastMovement] = useState<EditHistoryEntry | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  // Seleccion MULTIPLE nativa de React Flow (shift+clic, arrastre), separada
  // de selectedClassId/selectedRelationshipId del store (seleccion UNICA
  // que alimenta el panel de propiedades).
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  // Tamano real de cada clase medido por React Flow. Los nodos son una vista
  // del store (modo controlado), asi que si no se devuelve la medida al nodo
  // el minimapa no los dibuja y organizar/alinear/centrar calculan con un
  // tamano supuesto. Se lee del store interno (y no del evento "dimensions",
  // que React Flow emite una sola vez, a veces antes de conectar el callback);
  // el selector devuelve un string para que solo re-renderice si cambian.
  const measuredKey = useStore((s) =>
    Array.from(s.nodeLookup.values())
      .map((n) => `${n.id}:${n.measured?.width ?? 0}:${n.measured?.height ?? 0}`)
      .join('|'),
  );
  const nodeSizes = useMemo(() => {
    const sizes = new Map<string, { width: number; height: number }>();
    for (const entry of measuredKey ? measuredKey.split('|') : []) {
      const [id, width, height] = entry.split(':');
      if (Number(width) && Number(height)) sizes.set(id, { width: Number(width), height: Number(height) });
    }
    return sizes;
  }, [measuredKey]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Tipo de relacion que se crea al arrastrar entre clases (como elegir la
  // herramienta en el Toolbox de Enterprise Architect).
  const [connectKind, setConnectKind] = useState<RelationshipKind>('ASSOCIATION');
  const [explorerOpen, toggleExplorer] = usePanelPreference('editor.explorerOpen', true);
  const [propertiesOpen, toggleProperties] = usePanelPreference('editor.propertiesOpen', true);

  const classes = useUmlStore((state) => state.classes);
  const relationships = useUmlStore((state) => state.relationships);
  const selectedClassId = useUmlStore((state) => state.selectedClassId);
  const selectedRelationshipId = useUmlStore((state) => state.selectedRelationshipId);
  const selectClass = useUmlStore((state) => state.selectClass);
  const selectRelationship = useUmlStore((state) => state.selectRelationship);

  const xmi = useXmiTransfer(project?.name ?? 'modelo');

  // Datos que no cambian por Socket.IO (nombre del proyecto, integrantes).
  useEffect(() => {
    if (!projectId) return;
    getProjectDetail(projectId)
      .then((detail) => {
        setProject(detail.project);
        setMembers(detail.members);
      })
      .catch(() => setError('No se pudo cargar el proyecto (verifica que seas miembro)'));

    getProjectHistory(projectId, 1).then((entries) => {
      if (entries[0]) setLastMovement(entries[0]);
    });
  }, [projectId]);

  // Colaboracion en tiempo real (secciones 19-26).
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

  const associationClassIds = useMemo(
    () => new Set(relationships.map((r) => r.associationClassId).filter(Boolean)),
    [relationships],
  );
  const nodes = useMemo(
    () =>
      classes.map((klass) => ({
        ...classToNode(klass, associationClassIds.has(klass.id) ? 'clase asociacion' : undefined),
        selected: selectedNodeIds.has(klass.id) || klass.id === selectedClassId,
        measured: nodeSizes.get(klass.id),
      })),
    [classes, selectedNodeIds, selectedClassId, associationClassIds, nodeSizes],
  );
  const edges = useMemo(
    () => relationshipsToEdges(relationships).map((edge) => ({ ...edge, selected: edge.id === selectedRelationshipId })),
    [relationships, selectedRelationshipId],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // Una clase no puede heredar de si misma (una asociacion reflexiva si es valida).
      if (connection.source === connection.target && connectKind === 'GENERALIZATION') return;
      collaboration.createRelationship(connection.source, connection.target, connectKind);
    },
    [connectKind],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback((_event, _node, draggedNodes) => {
    collaboration.moveClasses(new Map(draggedNodes.map((n) => [n.id, n.position])));
  }, []);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => selectClass(node.id), [selectClass]);
  const handleEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => selectRelationship(edge.id), [selectRelationship]);

  // Solo se atienden los cambios de seleccion: la posicion durante un drag la
  // maneja React Flow y se persiste al soltar.
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const selectChanges = changes.filter((c): c is Extract<NodeChange, { type: 'select' }> => c.type === 'select');
    if (selectChanges.length === 0) return;
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      for (const change of selectChanges) {
        if (change.selected) next.add(change.id);
        else next.delete(change.id);
      }
      return next;
    });
  }, []);

  // Nueva clase en el centro de lo que se esta viendo (no en una esquina fija
  // que puede quedar fuera de la vista).
  const handleAddClass = useCallback(() => {
    const canvas = document.querySelector('.react-flow');
    const rect = canvas?.getBoundingClientRect();
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 80, y: 80 };
    const offset = (classes.length % 5) * 24;
    collaboration.createClass({ x: Math.round(center.x - 100 + offset), y: Math.round(center.y - 60 + offset) });
  }, [classes.length, screenToFlowPosition]);

  function handleOrganize() {
    collaboration.moveClasses(computeDagreLayout(nodes, relationships));
    window.setTimeout(() => fitView({ duration: 300, padding: 0.15 }), 60);
  }

  // Explorador -> seleccionar y centrar la vista en la clase.
  const focusClass = useCallback(
    (classId: string, options: { select?: boolean } = {}) => {
      if (options.select !== false) selectClass(classId);
      const node = getNode(classId);
      if (!node) return;
      const width = node.measured?.width ?? 200;
      const height = node.measured?.height ?? 120;
      setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: Math.max(getZoom(), 0.9),
        duration: 350,
      });
    },
    [getNode, getZoom, selectClass, setCenter],
  );

  // Atajos: Supr elimina lo seleccionado; Ctrl +/-/0 controlan el zoom del
  // diagrama (no el del navegador). Se ignoran mientras se escribe.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      if (event.ctrlKey || event.metaKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          zoomIn({ duration: 150 });
        } else if (event.key === '-') {
          event.preventDefault();
          zoomOut({ duration: 150 });
        } else if (event.key === '0') {
          event.preventDefault();
          fitView({ duration: 250, padding: 0.15 });
        }
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (selectedNodeIds.size > 1) {
        if (!window.confirm(`¿Eliminar las ${selectedNodeIds.size} clases seleccionadas?`)) return;
        selectedNodeIds.forEach((id) => collaboration.deleteClass(id));
        setSelectedNodeIds(new Set());
      } else if (selectedClassId) {
        collaboration.deleteClass(selectedClassId);
      } else if (selectedRelationshipId) {
        collaboration.deleteRelationship(selectedRelationshipId);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClassId, selectedRelationshipId, selectedNodeIds, zoomIn, zoomOut, fitView]);

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: 'pane', flowPosition } });
    },
    [screenToFlowPosition],
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      selectClass(node.id);
      setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: 'node', classId: node.id } });
    },
    [selectClass],
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      selectRelationship(edge.id);
      setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: 'edge', relationshipId: edge.id } });
    },
    [selectRelationship],
  );

  const contextMenuContent = useMemo((): { title?: string; items: ContextMenuItem[] } => {
    if (!contextMenu) return { items: [] };
    const { target } = contextMenu;

    if (target.kind === 'pane') {
      return {
        items: [
          { label: 'Nueva clase aqui', icon: <IconClass size={14} />, onClick: () => collaboration.createClass(target.flowPosition) },
          { label: 'Ajustar a la pantalla', icon: <IconFit size={14} />, shortcut: 'Ctrl 0', onClick: () => fitView({ duration: 250, padding: 0.15 }) },
        ],
      };
    }

    if (target.kind === 'node') {
      const klass = classes.find((c) => c.id === target.classId);
      return {
        title: klass?.name,
        items: [
          {
            label: 'Duplicar clase',
            icon: <IconCopy size={14} />,
            onClick: () => klass && collaboration.duplicateClass(klass, { x: klass.position.x + 40, y: klass.position.y + 40 }),
          },
          {
            label: 'Eliminar clase',
            icon: <IconTrash size={14} />,
            shortcut: 'Supr',
            danger: true,
            separatorBefore: true,
            onClick: () => collaboration.deleteClass(target.classId),
          },
        ],
      };
    }

    const relationship = relationships.find((r) => r.id === target.relationshipId);
    const nameOf = (id: string | undefined) => classes.find((c) => c.id === id)?.name ?? '?';
    return {
      title: relationship ? `${nameOf(relationship.sourceClassId)} → ${nameOf(relationship.targetClassId)}` : undefined,
      items: [
        {
          label: 'Invertir direccion',
          icon: <IconSwap size={14} />,
          onClick: () => relationship && collaboration.reverseRelationship(relationship),
        },
        {
          label: 'Eliminar relacion',
          icon: <IconTrash size={14} />,
          shortcut: 'Supr',
          danger: true,
          separatorBefore: true,
          onClick: () => collaboration.deleteRelationship(target.relationshipId),
        },
      ],
    };
  }, [contextMenu, classes, relationships, fitView]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const memberNames = useMemo(() => Object.fromEntries(members.map((m) => [m.userId, m.userName])), [members]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link to="/projects" className="text-sm font-medium text-indigo-700 hover:text-indigo-800">
          Volver a mis proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <EditorTopBar
        project={project}
        members={members}
        onlineUserIds={onlineUserIds}
        onValidate={() => setValidationOpen(true)}
        onGenerate={() => setGeneratorOpen(true)}
      />
      <EditorToolbar
        connectKind={connectKind}
        onConnectKindChange={setConnectKind}
        onAddClass={handleAddClass}
        onOrganize={handleOrganize}
        canOrganize={classes.length > 1}
        xmi={xmi}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((open) => !open)}
        onOpenHistory={() => setHistoryOpen(true)}
        explorerOpen={explorerOpen}
        onToggleExplorer={toggleExplorer}
        propertiesOpen={propertiesOpen}
        onToggleProperties={toggleProperties}
      />
      {xmi.fileInput}

      <div className="flex min-h-0 flex-1">
        {explorerOpen && <ModelExplorer onFocusClass={focusClass} />}

        <main className="relative min-w-0 flex-1" style={{ background: CANVAS_BG }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onConnect={handleConnect}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={{ stroke: '#4f46e5', strokeWidth: 1.5, strokeDasharray: '5 4' }}
            onNodesChange={handleNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneClick={() => {
              selectClass(null);
              selectRelationship(null);
            }}
            deleteKeyCode={null}
            snapToGrid
            snapGrid={GRID_SIZE}
            minZoom={0.15}
            maxZoom={2.5}
            fitView
            fitViewOptions={{ padding: 0.15 }}
          >
            <Background variant={BackgroundVariant.Dots} color="#c3cad5" gap={16} size={1.2} />
            {classes.length > 0 && <MiniMap
              position="bottom-left"
              pannable
              zoomable
              ariaLabel="Mapa del diagrama"
              nodeColor={(node) => (node.selected ? '#c7d2fe' : '#e2e8f0')}
              nodeStrokeColor={(node) => (node.selected ? '#4f46e5' : '#64748b')}
              nodeStrokeWidth={6}
              nodeBorderRadius={2}
              maskColor="rgb(245 246 248 / 0.7)"
              className="!m-3 overflow-hidden !rounded-md !border !border-slate-200 !bg-white !shadow-sm"
              style={{ width: 168, height: 112 }}
            />}
            {selectedNodeIds.size >= 2 && (
              <Panel position="top-center">
                <AlignmentToolbar selectedIds={Array.from(selectedNodeIds)} />
              </Panel>
            )}
          </ReactFlow>

          {classes.length === 0 && status === 'connected' && !aiOpen && (
            <CanvasEmptyState onAddClass={handleAddClass} onImport={xmi.openImport} onOpenAi={() => setAiOpen(true)} />
          )}
          {aiOpen && <AiPanel onClose={() => setAiOpen(false)} />}
          <TransferNoticeToast notice={xmi.notice} onDismiss={xmi.dismissNotice} />
        </main>

        {propertiesOpen && <PropertiesPanel multiSelectionCount={selectedNodeIds.size} />}
      </div>

      <StatusBar status={status} lastMovement={lastMovement} memberNames={memberNames} onOpenHistory={() => setHistoryOpen(true)} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={contextMenuContent.title}
          items={contextMenuContent.items}
          onClose={closeContextMenu}
        />
      )}

      {historyOpen && projectId && (
        <HistoryPanel projectId={projectId} memberNames={memberNames} onClose={() => setHistoryOpen(false)} />
      )}
      {validationOpen && projectId && <ValidationPanel projectId={projectId} onClose={() => setValidationOpen(false)} />}
      {generatorOpen && projectId && <GeneratorPanel projectId={projectId} onClose={() => setGeneratorOpen(false)} />}
    </div>
  );
}
