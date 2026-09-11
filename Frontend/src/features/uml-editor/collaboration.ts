import { getSocket } from '../../services/socket';
import { getUmlModel } from '../../services/umlApi';
import { useUmlStore } from '../../store/umlStore';
import type { Multiplicity, RelationshipType, UmlAttribute, UmlClass, UmlDataType, UmlModel, UmlRelationship } from '../../types/uml';
import type { EditHistoryEntry } from '../../types/history';

// Capa de colaboracion: unico lugar del frontend que conoce Socket.IO.
// Traduce interacciones del usuario en operaciones (seccion 22), las aplica
// de forma optimista al store local y las emite al servidor; y traduce los
// eventos entrantes (seccion 21) de vuelta a la misma funcion del store.
// El store y los componentes de UI no importan `socket.io-client`.

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type Listener<T> = (value: T) => void;

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

function emitOperation(operation: Record<string, unknown>) {
  const socket = getSocket();
  socket.emit('uml_operation', operation, (ack?: { ok: boolean; error?: string }) => {
    if (ack && !ack.ok) {
      // Reconciliacion simple ante un rechazo (seccion 26): en vez de
      // intentar resolver el conflicto, se vuelve a pedir el estado actual.
      console.error('Operacion UML rechazada:', ack.error);
      if (currentProjectId) {
        const projectId = currentProjectId;
        getUmlModel(projectId).then((model) => useUmlStore.getState().loadModel(projectId, model));
      }
    }
  });
}

function resyncModel(projectId: string) {
  getUmlModel(projectId).then((model) => useUmlStore.getState().loadModel(projectId, model));
}

export function connectToProject(projectId: string) {
  currentProjectId = projectId;
  const socket = getSocket();

  socket.off('connect');
  socket.off('disconnect');
  socket.off('join_rejected');
  socket.off('presence_update');
  socket.off('class_created');
  socket.off('class_updated');
  socket.off('class_deleted');
  socket.off('element_moved');
  socket.off('attribute_created');
  socket.off('attribute_updated');
  socket.off('attribute_deleted');
  socket.off('relationship_created');
  socket.off('relationship_updated');
  socket.off('relationship_deleted');
  socket.off('history_entry');
  socket.off('model_replaced');

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

  socket.on('class_created', (p) => useUmlStore.getState().applyCreateClass(p));
  socket.on('class_updated', (p) => useUmlStore.getState().applyRenameClass(p));
  socket.on('class_deleted', (p) => useUmlStore.getState().applyDeleteClass(p));
  socket.on('element_moved', (p) => useUmlStore.getState().applyMoveClass(p));
  socket.on('attribute_created', (p) => useUmlStore.getState().applyAddAttribute(p));
  socket.on('attribute_updated', (p) => useUmlStore.getState().applyUpdateAttribute(p));
  socket.on('attribute_deleted', (p) => useUmlStore.getState().applyRemoveAttribute(p));
  socket.on('relationship_created', (p) => useUmlStore.getState().applyCreateRelationship(p));
  socket.on('relationship_updated', (p: { operation: string }) => {
    if (p.operation === 'SET_MULTIPLICITY') {
      useUmlStore.getState().applySetMultiplicity(p as never);
    } else {
      useUmlStore.getState().applyUpdateRelationship(p as never);
    }
  });
  socket.on('relationship_deleted', (p) => useUmlStore.getState().applyDeleteRelationship(p));

  // Historial (seccion 27): se difunde a todos, incluido quien hizo el
  // cambio, para alimentar el "ultimo movimiento" en vivo.
  socket.on('history_entry', (entry: EditHistoryEntry) => historyListeners.forEach((l) => l(entry)));

  // Importar reemplaza el grafo entero: no hay un set chico de campos que
  // traducir a un evento puntual, asi que todos (incluido quien importo)
  // simplemente recargan el modelo completo recibido.
  socket.on('model_replaced', (model: UmlModel) => useUmlStore.getState().loadModel(projectId, model));

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
  const op = { classId: newId(), name: 'NuevaClase', position };
  useUmlStore.getState().applyCreateClass(op);
  emitOperation({ operation: 'CREATE_CLASS', ...op });
}

export function renameClass(classId: string, name: string) {
  const op = { classId, name };
  useUmlStore.getState().applyRenameClass(op);
  emitOperation({ operation: 'RENAME_CLASS', ...op });
}

export function moveClass(classId: string, position: { x: number; y: number }) {
  const op = { classId, position };
  useUmlStore.getState().applyMoveClass(op);
  emitOperation({ operation: 'MOVE_ELEMENT', ...op });
}

export function deleteClass(classId: string) {
  useUmlStore.getState().applyDeleteClass({ classId });
  emitOperation({ operation: 'DELETE_CLASS', classId });
}

// Duplica una clase con sus atributos (no las relaciones: una relacion
// habla de dos clases especificas, copiarla junto a la clase duplicaria su
// significado sin que el usuario lo haya pedido). Reutiliza createClass +
// addAttribute uno por uno para que la copia pase por las mismas
// operaciones normales (validables, colaborativas), en vez de un evento
// especial "duplicate" que el resto del sistema tendria que conocer.
export function duplicateClass(source: UmlClass, position: { x: number; y: number }) {
  const classId = newId();
  const op = { classId, name: `${source.name} copia`, position };
  useUmlStore.getState().applyCreateClass(op);
  emitOperation({ operation: 'CREATE_CLASS', ...op });

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
    emitOperation({ operation: 'ADD_ATTRIBUTE', ...attributeOp });
  }

  return classId;
}

export function addAttribute(classId: string) {
  const op = {
    classId,
    attributeId: newId(),
    name: 'atributo',
    type: 'String' as UmlDataType,
    isPrimaryKey: false,
    nullable: true,
  };
  useUmlStore.getState().applyAddAttribute(op);
  emitOperation({ operation: 'ADD_ATTRIBUTE', ...op });
}

export function updateAttribute(classId: string, attributeId: string, patch: Partial<UmlAttribute>) {
  const op = { classId, attributeId, ...patch };
  useUmlStore.getState().applyUpdateAttribute(op);
  emitOperation({ operation: 'UPDATE_ATTRIBUTE', ...op });
}

export function removeAttribute(classId: string, attributeId: string) {
  useUmlStore.getState().applyRemoveAttribute({ classId, attributeId });
  emitOperation({ operation: 'REMOVE_ATTRIBUTE', classId, attributeId });
}

export function createRelationship(sourceClassId: string, targetClassId: string) {
  const op = {
    relationshipId: newId(),
    sourceClassId,
    targetClassId,
    type: 'ONE_TO_MANY' as RelationshipType,
    sourceMultiplicity: '1' as Multiplicity,
    targetMultiplicity: 'N' as Multiplicity,
  };
  useUmlStore.getState().applyCreateRelationship(op);
  emitOperation({ operation: 'CREATE_RELATIONSHIP', ...op });
}

export function updateRelationshipType(relationshipId: string, type: RelationshipType) {
  const op = { relationshipId, type };
  useUmlStore.getState().applyUpdateRelationship(op);
  emitOperation({ operation: 'UPDATE_RELATIONSHIP', ...op });
}

export function setMultiplicity(
  relationshipId: string,
  sourceMultiplicity: Multiplicity,
  targetMultiplicity: Multiplicity,
) {
  const op = { relationshipId, sourceMultiplicity, targetMultiplicity };
  useUmlStore.getState().applySetMultiplicity(op);
  emitOperation({ operation: 'SET_MULTIPLICITY', ...op });
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

// A diferencia de las mutaciones manuales, aca no se aplica nada de forma
// optimista: el resultado llega como eventos normales (class_created, etc.)
// que ya estan escuchados arriba, incluso para quien pidio el cambio
// (seccion 30).
export function sendAiPrompt(prompt: string): Promise<AiCommandResult> {
  return new Promise((resolve) => {
    const socket = getSocket();
    socket.emit('ai_command', { prompt }, (ack?: AiCommandResult) => {
      resolve(ack ?? { ok: false, error: 'Sin respuesta del servidor' });
    });
  });
}

// Foto de un diagrama (pizarra, papel, otra herramienta): mismo evento y
// mismo resultado que un prompt de texto, la IA en el backend reconoce el
// contenido de la imagen y produce los mismos comandos estructurados.
export function sendAiImage(imageBase64: string, mimeType: string): Promise<AiCommandResult> {
  return new Promise((resolve) => {
    const socket = getSocket();
    socket.emit('ai_command', { image: { data: imageBase64, mimeType } }, (ack?: AiCommandResult) => {
      resolve(ack ?? { ok: false, error: 'Sin respuesta del servidor' });
    });
  });
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
    const socket = getSocket();
    socket.emit('import_model', { classes, relationships }, (ack?: ImportModelResult) => {
      resolve(ack ?? { ok: false, error: 'Sin respuesta del servidor' });
    });
  });
}

export function exportModel(): { classes: UmlClass[]; relationships: UmlRelationship[] } {
  const state = useUmlStore.getState();
  return { classes: state.classes, relationships: state.relationships };
}
