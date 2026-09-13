import { getSocket } from '../../services/socket';
import { getUmlModel } from '../../services/umlApi';
import { useUmlStore } from '../../store/umlStore';
import type { RelationshipPatch } from '../../store/umlStore';
import { DEFAULT_MULTIPLICITIES } from '../../types/uml';
import type { RelationshipKind, UmlAttribute, UmlClass, UmlDataType, UmlModel, UmlRelationship } from '../../types/uml';
import type { EditHistoryEntry } from '../../types/history';

// Capa de colaboracion: unico lugar del frontend que conoce Socket.IO.
// Traduce interacciones del usuario en operaciones (seccion 22), las aplica
// de forma optimista al store local y las emite al servidor; y traduce los
// eventos entrantes (seccion 21) de vuelta a la misma funcion del store.
// El store y los componentes de UI no importan `socket.io-client`.

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type Listener<T> = (value: T) => void;
type Operation = { operation: string } & Record<string, unknown>;

let currentProjectId: string | null = null;
let presenceListeners: Listener<string[]>[] = [];
let statusListeners: Listener<ConnectionStatus>[] = [];
let historyListeners: Listener<EditHistoryEntry>[] = [];
let onlineUserIds: string[] = [];
let connectionStatus: ConnectionStatus = 'disconnected';

function setStatus(status: ConnectionStatus) {
  connectionStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

function setPresence(userIds: string[]) {
  onlineUserIds = userIds;
  presenceListeners.forEach((listener) => listener(userIds));
}

function newId(): string {
  return crypto.randomUUID();
}

function resyncModel(projectId: string) {
  getUmlModel(projectId).then((model) => useUmlStore.getState().loadModel(projectId, model));
}

// Reconciliacion simple ante un rechazo (seccion 26): en vez de intentar
// resolver el conflicto, se vuelve a pedir el estado actual.
function handleAck(ack?: { ok: boolean; error?: string }) {
  if (ack && !ack.ok) {
    console.error('Operacion UML rechazada:', ack.error);
    if (currentProjectId) resyncModel(currentProjectId);
  }
}

function emitOperation(operation: Operation) {
  getSocket().emit('uml_operation', operation, handleAck);
}

// Varias operaciones en una sola escritura (organizar, alinear, duplicar):
// una transaccion en el servidor en vez de una por clase.
function emitOperations(operations: Operation[]) {
  if (operations.length === 0) return;
  if (operations.length === 1) {
    emitOperation(operations[0]);
    return;
  }
  getSocket().emit('uml_operations', operations, handleAck);
}

const UML_EVENTS = [
  'class_created',
  'class_updated',
  'class_deleted',
  'element_moved',
  'attribute_created',
  'attribute_updated',
  'attribute_deleted',
  'relationship_created',
  'relationship_updated',
  'relationship_deleted',
];

export function connectToProject(projectId: string) {
  currentProjectId = projectId;
  const socket = getSocket();

  for (const event of ['connect', 'disconnect', 'join_rejected', 'presence_update', 'history_entry', 'model_replaced', ...UML_EVENTS]) {
    socket.off(event);
  }

  socket.on('connect', () => {
    setStatus('connected');
    socket.emit('join_project', { projectId });
    // Al (re)conectar siempre se vuelve a pedir el modelo (seccion 26): asi
    // se converge con lo que paso mientras no habia conexion.
    resyncModel(projectId);
  });
  socket.on('disconnect', () => setStatus('disconnected'));
  socket.io.on('reconnect_attempt', () => setStatus('connecting'));

  socket.on('join_rejected', (data: { error: string }) => console.error('join_project rechazado:', data.error));
  socket.on('presence_update', (data: { userIds: string[] }) => setPresence(data.userIds));

  // Eventos remotos: nunca cambian la seleccion local.
  const store = () => useUmlStore.getState();
  socket.on('class_created', (p) => store().applyCreateClass(p));
  socket.on('class_updated', (p) => store().applyRenameClass(p));
  socket.on('class_deleted', (p) => store().applyDeleteClass(p));
  socket.on('element_moved', (p) => store().applyMoveClass(p));
  socket.on('attribute_created', (p) => store().applyAddAttribute(p));
  socket.on('attribute_updated', (p) => store().applyUpdateAttribute(p));
  socket.on('attribute_deleted', (p) => store().applyRemoveAttribute(p));
  socket.on('relationship_created', (p) => store().applyCreateRelationship(p));
  socket.on('relationship_updated', (p: RelationshipPatch) => store().applyUpdateRelationship(p));
  socket.on('relationship_deleted', (p) => store().applyDeleteRelationship(p));

  // Historial (seccion 27): se difunde a todos, incluido quien hizo el
  // cambio, para alimentar el "ultimo movimiento" en vivo.
  socket.on('history_entry', (entry: EditHistoryEntry) => historyListeners.forEach((l) => l(entry)));

  // Importar o aplicar un pedido de IA reemplaza el grafo entero: todos
  // (incluido quien lo pidio) recargan el modelo completo recibido.
  socket.on('model_replaced', (model: UmlModel) => store().loadModel(projectId, model));

  if (socket.connected) {
    setStatus('connected');
    socket.emit('join_project', { projectId });
    resyncModel(projectId);
  } else {
    setStatus('connecting');
    socket.connect();
  }
}

export function disconnectFromProject() {
  const socket = getSocket();
  if (currentProjectId) socket.emit('leave_project');
  socket.disconnect();
  currentProjectId = null;
  setPresence([]);
  setStatus('disconnected');
}

export function subscribePresence(listener: Listener<string[]>) {
  presenceListeners.push(listener);
  listener(onlineUserIds);
  return () => {
    presenceListeners = presenceListeners.filter((l) => l !== listener);
  };
}

export function subscribeConnectionStatus(listener: Listener<ConnectionStatus>) {
  statusListeners.push(listener);
  listener(connectionStatus);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

export function subscribeHistory(listener: Listener<EditHistoryEntry>) {
  historyListeners.push(listener);
  return () => {
    historyListeners = historyListeners.filter((l) => l !== listener);
  };
}

export function createClass(position: { x: number; y: number }) {
  const existingNames = new Set(useUmlStore.getState().classes.map((c) => c.name));
  let name = 'NuevaClase';
  for (let i = 2; existingNames.has(name); i++) name = `NuevaClase${i}`;
  const op = { classId: newId(), name, position };
  useUmlStore.getState().applyCreateClass(op, { select: true });
  emitOperation({ operation: 'CREATE_CLASS', ...op });
}

export function renameClass(classId: string, name: string) {
  const op = { classId, name };
  useUmlStore.getState().applyRenameClass(op);
  emitOperation({ operation: 'RENAME_CLASS', ...op });
}

export function moveClass(classId: string, position: { x: number; y: number }) {
  moveClasses(new Map([[classId, position]]));
}

export function moveClasses(positions: Map<string, { x: number; y: number }>) {
  const operations: Operation[] = [];
  positions.forEach((position, classId) => {
    const rounded = { x: Math.round(position.x), y: Math.round(position.y) };
    useUmlStore.getState().applyMoveClass({ classId, position: rounded });
    operations.push({ operation: 'MOVE_ELEMENT', classId, position: rounded });
  });
  emitOperations(operations);
}

export function deleteClass(classId: string) {
  useUmlStore.getState().applyDeleteClass({ classId });
  emitOperation({ operation: 'DELETE_CLASS', classId });
}

// Duplica una clase con sus atributos (no las relaciones: una relacion
// habla de dos clases especificas, copiarla junto a la clase duplicaria su
// significado sin que el usuario lo haya pedido).
export function duplicateClass(source: UmlClass, position: { x: number; y: number }) {
  const classId = newId();
  const classOp = { classId, name: `${source.name}Copia`, position };
  useUmlStore.getState().applyCreateClass(classOp, { select: true });
  const operations: Operation[] = [{ operation: 'CREATE_CLASS', ...classOp }];

  for (const attr of source.attributes) {
    const attributeOp = {
      classId,
      attributeId: newId(),
      name: attr.name,
      type: attr.type,
      isPrimaryKey: attr.isPrimaryKey,
      nullable: attr.nullable,
      defaultValue: attr.defaultValue,
    };
    useUmlStore.getState().applyAddAttribute(attributeOp);
    operations.push({ operation: 'ADD_ATTRIBUTE', ...attributeOp });
  }

  emitOperations(operations);
  return classId;
}

export function addAttribute(classId: string) {
  const klass = useUmlStore.getState().classes.find((c) => c.id === classId);
  const existingNames = new Set(klass?.attributes.map((a) => a.name));
  let name = 'atributo';
  for (let i = 2; existingNames.has(name); i++) name = `atributo${i}`;
  const op = {
    classId,
    attributeId: newId(),
    name,
    type: 'String' as UmlDataType,
    isPrimaryKey: false,
    nullable: true,
  };
  useUmlStore.getState().applyAddAttribute(op);
  emitOperation({ operation: 'ADD_ATTRIBUTE', ...op });
}

export function updateAttribute(classId: string, attributeId: string, patch: Partial<Omit<UmlAttribute, 'id'>>) {
  const op = { classId, attributeId, ...patch };
  useUmlStore.getState().applyUpdateAttribute(op);
  emitOperation({ operation: 'UPDATE_ATTRIBUTE', ...op });
}

export function removeAttribute(classId: string, attributeId: string) {
  useUmlStore.getState().applyRemoveAttribute({ classId, attributeId });
  emitOperation({ operation: 'REMOVE_ATTRIBUTE', classId, attributeId });
}

export function createRelationship(sourceClassId: string, targetClassId: string, kind: RelationshipKind = 'ASSOCIATION') {
  const defaults = DEFAULT_MULTIPLICITIES[kind];
  const op = {
    relationshipId: newId(),
    sourceClassId,
    targetClassId,
    kind,
    sourceMultiplicity: defaults.source,
    targetMultiplicity: defaults.target,
  };
  useUmlStore.getState().applyCreateRelationship(op, { select: true });
  emitOperation({ operation: 'CREATE_RELATIONSHIP', ...op });
}

export function updateRelationship(patch: RelationshipPatch) {
  useUmlStore.getState().applyUpdateRelationship(patch);
  emitOperation({ operation: 'UPDATE_RELATIONSHIP', ...patch });
}

// Invierte origen y destino (con sus multiplicidades): util cuando una
// herencia o una composicion se dibujo en el sentido contrario.
export function reverseRelationship(relationship: UmlRelationship) {
  updateRelationship({
    relationshipId: relationship.id,
    sourceClassId: relationship.targetClassId,
    targetClassId: relationship.sourceClassId,
    sourceMultiplicity: relationship.targetMultiplicity,
    targetMultiplicity: relationship.sourceMultiplicity,
  });
}

export function deleteRelationship(relationshipId: string) {
  useUmlStore.getState().applyDeleteRelationship({ relationshipId });
  emitOperation({ operation: 'DELETE_RELATIONSHIP', relationshipId });
}

export interface AiCommandResult {
  ok: boolean;
  error?: string;
  applied?: number;
  skipped?: { reason: string }[];
}

// La IA puede tardar (sobre todo con imagenes): margen amplio antes de
// dar el pedido por perdido.
const AI_TIMEOUT_MS = 180_000;

function emitAiCommand(payload: Record<string, unknown>): Promise<AiCommandResult> {
  return new Promise((resolve) => {
    getSocket()
      .timeout(AI_TIMEOUT_MS)
      .emit('ai_command', payload, (err: Error | null, ack?: AiCommandResult) => {
        if (err) resolve({ ok: false, error: 'La IA tardo demasiado en responder, intenta de nuevo' });
        else resolve(ack ?? { ok: false, error: 'Sin respuesta del servidor' });
      });
  });
}

// A diferencia de las mutaciones manuales, aca no se aplica nada de forma
// optimista: el resultado llega como 'model_replaced' para todos (seccion 30).
export function sendAiPrompt(prompt: string): Promise<AiCommandResult> {
  return emitAiCommand({ prompt });
}

// Foto, captura o PDF de un diagrama: la IA en el backend reconoce el
// contenido y produce los mismos comandos estructurados. `prompt` son
// indicaciones opcionales del usuario.
export function sendAiFile(base64: string, mimeType: string, prompt?: string): Promise<AiCommandResult> {
  return emitAiCommand({ image: { data: base64, mimeType }, ...(prompt ? { prompt } : {}) });
}

export interface ImportModelResult {
  ok: boolean;
  error?: string;
}

// Reemplaza el modelo completo del proyecto (clases + relaciones). El
// servidor valida forma y pertenencia; el resultado llega para todos via
// el evento 'model_replaced' (incluido quien importo).
export function importModel(classes: UmlClass[], relationships: UmlRelationship[]): Promise<ImportModelResult> {
  return new Promise((resolve) => {
    getSocket().emit('import_model', { classes, relationships }, (ack?: ImportModelResult) => {
      resolve(ack ?? { ok: false, error: 'Sin respuesta del servidor' });
    });
  });
}
