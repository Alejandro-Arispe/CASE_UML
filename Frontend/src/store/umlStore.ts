import { create } from 'zustand';
import type { Multiplicity, RelationshipKind, UmlAttribute, UmlClass, UmlDataType, UmlModel, UmlRelationship } from '../types/uml';

// Estado canonico del diagrama UML, independiente de React Flow y de
// Socket.IO (seccion 6/45): el canvas es una vista derivada de este store,
// nunca la fuente de verdad, y el store no sabe que existe una red.
//
// Cada `apply*` tiene la MISMA forma que la operacion correspondiente que
// viaja por Socket.IO (ver Backend `umlOperations.ts`): la capa de
// colaboracion (`features/uml-editor/collaboration.ts`) llama a la misma
// funcion tanto para el cambio optimista local como para un evento remoto.
//
// `select` solo lo pasa quien crea el elemento localmente: si un
// colaborador (o la IA) crea una clase, a los demas NO se les cambia la
// seleccion ni se les abre el panel de propiedades.

export interface RelationshipPatch {
  relationshipId: string;
  kind?: RelationshipKind;
  sourceClassId?: string;
  targetClassId?: string;
  sourceMultiplicity?: Multiplicity;
  targetMultiplicity?: Multiplicity;
  name?: string;
  associationClassId?: string | null;
}

interface SelectOptions {
  select?: boolean;
}

interface UmlState {
  projectId: string | null;
  revision: number;
  classes: UmlClass[];
  relationships: UmlRelationship[];
  selectedClassId: string | null;
  selectedRelationshipId: string | null;

  loadModel: (projectId: string, model: UmlModel) => void;
  selectClass: (id: string | null) => void;
  selectRelationship: (id: string | null) => void;

  applyCreateClass: (op: { classId: string; name: string; position: { x: number; y: number } }, options?: SelectOptions) => void;
  applyRenameClass: (op: { classId: string; name: string }) => void;
  applyMoveClass: (op: { classId: string; position: { x: number; y: number } }) => void;
  applyDeleteClass: (op: { classId: string }) => void;

  applyAddAttribute: (
    op: { classId: string; attributeId: string; name: string; type: UmlDataType } & Partial<
      Pick<UmlAttribute, 'isPrimaryKey' | 'nullable' | 'defaultValue'>
    >,
  ) => void;
  applyUpdateAttribute: (op: { classId: string; attributeId: string } & Partial<Omit<UmlAttribute, 'id'>>) => void;
  applyRemoveAttribute: (op: { classId: string; attributeId: string }) => void;

  applyCreateRelationship: (
    op: {
      relationshipId: string;
      sourceClassId: string;
      targetClassId: string;
      kind: RelationshipKind;
      sourceMultiplicity: Multiplicity;
      targetMultiplicity: Multiplicity;
      name?: string;
      associationClassId?: string;
    },
    options?: SelectOptions,
  ) => void;
  applyUpdateRelationship: (patch: RelationshipPatch) => void;
  applyDeleteRelationship: (op: { relationshipId: string }) => void;
}

function cleanName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed ? trimmed : undefined;
}

export const useUmlStore = create<UmlState>((set) => ({
  projectId: null,
  revision: 0,
  classes: [],
  relationships: [],
  selectedClassId: null,
  selectedRelationshipId: null,

  // Al recargar el modelo (reconexion, import, IA) se conserva la seleccion
  // si el elemento sigue existiendo.
  loadModel: (projectId, model) =>
    set((state) => ({
      projectId,
      revision: model.revision,
      classes: model.classes,
      relationships: model.relationships,
      selectedClassId: model.classes.some((c) => c.id === state.selectedClassId) ? state.selectedClassId : null,
      selectedRelationshipId: model.relationships.some((r) => r.id === state.selectedRelationshipId)
        ? state.selectedRelationshipId
        : null,
    })),

  selectClass: (id) => set({ selectedClassId: id, selectedRelationshipId: null }),
  selectRelationship: (id) => set({ selectedRelationshipId: id, selectedClassId: null }),

  applyCreateClass: ({ classId, name, position }, options) =>
    set((state) => {
      if (state.classes.some((c) => c.id === classId)) return {};
      return {
        classes: [...state.classes, { id: classId, name, position, attributes: [] }],
        ...(options?.select ? { selectedClassId: classId, selectedRelationshipId: null } : {}),
      };
    }),

  applyRenameClass: ({ classId, name }) =>
    set((state) => ({
      classes: state.classes.map((c) => (c.id === classId ? { ...c, name } : c)),
    })),

  applyMoveClass: ({ classId, position }) =>
    set((state) => ({
      classes: state.classes.map((c) => (c.id === classId ? { ...c, position } : c)),
    })),

  applyDeleteClass: ({ classId }) =>
    set((state) => ({
      classes: state.classes.filter((c) => c.id !== classId),
      relationships: state.relationships
        .filter((r) => r.sourceClassId !== classId && r.targetClassId !== classId)
        .map((r) => (r.associationClassId === classId ? { ...r, associationClassId: undefined } : r)),
      selectedClassId: state.selectedClassId === classId ? null : state.selectedClassId,
    })),

  applyAddAttribute: ({ classId, attributeId, name, type, isPrimaryKey, nullable, defaultValue }) =>
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId && !c.attributes.some((a) => a.id === attributeId)
          ? {
              ...c,
              attributes: [
                ...c.attributes,
                { id: attributeId, name, type, isPrimaryKey: isPrimaryKey ?? false, nullable: nullable ?? true, defaultValue },
              ],
            }
          : c,
      ),
    })),

  applyUpdateAttribute: ({ classId, attributeId, ...patch }) =>
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? { ...c, attributes: c.attributes.map((a) => (a.id === attributeId ? { ...a, ...patch } : a)) }
          : c,
      ),
    })),

  applyRemoveAttribute: ({ classId, attributeId }) =>
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId ? { ...c, attributes: c.attributes.filter((a) => a.id !== attributeId) } : c,
      ),
    })),

  applyCreateRelationship: (op, options) =>
    set((state) => {
      if (state.relationships.some((r) => r.id === op.relationshipId)) return {};
      return {
        relationships: [
          ...state.relationships,
          {
            id: op.relationshipId,
            sourceClassId: op.sourceClassId,
            targetClassId: op.targetClassId,
            kind: op.kind,
            sourceMultiplicity: op.sourceMultiplicity,
            targetMultiplicity: op.targetMultiplicity,
            name: cleanName(op.name),
            associationClassId: op.associationClassId || undefined,
          },
        ],
        ...(options?.select ? { selectedRelationshipId: op.relationshipId, selectedClassId: null } : {}),
      };
    }),

  // Mismo parche parcial que UPDATE_RELATIONSHIP en el backend (tambien
  // recibe SET_MULTIPLICITY, que es un subconjunto).
  applyUpdateRelationship: (patch) =>
    set((state) => ({
      relationships: state.relationships.map((r) => {
        if (r.id !== patch.relationshipId) return r;
        const updated: UmlRelationship = {
          ...r,
          ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
          ...(patch.sourceClassId !== undefined ? { sourceClassId: patch.sourceClassId } : {}),
          ...(patch.targetClassId !== undefined ? { targetClassId: patch.targetClassId } : {}),
          ...(patch.sourceMultiplicity !== undefined ? { sourceMultiplicity: patch.sourceMultiplicity } : {}),
          ...(patch.targetMultiplicity !== undefined ? { targetMultiplicity: patch.targetMultiplicity } : {}),
          ...(patch.name !== undefined ? { name: cleanName(patch.name) } : {}),
          ...(patch.associationClassId !== undefined ? { associationClassId: patch.associationClassId || undefined } : {}),
        };
        if (updated.kind !== 'ASSOCIATION') updated.associationClassId = undefined;
        return updated;
      }),
    })),

  applyDeleteRelationship: ({ relationshipId }) =>
    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== relationshipId),
      selectedRelationshipId: state.selectedRelationshipId === relationshipId ? null : state.selectedRelationshipId,
    })),
}));
