import { create } from 'zustand';
import type {
  Multiplicity,
  RelationshipType,
  UmlAttribute,
  UmlClass,
  UmlDataType,
  UmlModel,
} from '../types/uml';

// Estado canonico del diagrama UML, independiente de React Flow y de
// Socket.IO (seccion 6/45): el canvas es una vista derivada de este store,
// nunca la fuente de verdad, y el store no sabe que existe una red.
//
// Cada `apply*` tiene la MISMA forma que la operacion correspondiente que
// viaja por Socket.IO (ver Backend `umlOperations.ts`): la capa de
// colaboracion (`features/uml-editor/collaboration.ts`) llama a la misma
// funcion tanto para el cambio optimista local como para un evento remoto
// recibido del servidor.
interface UmlState {
  projectId: string | null;
  revision: number;
  classes: UmlClass[];
  relationships: UmlRelationshipState[];
  selectedClassId: string | null;
  selectedRelationshipId: string | null;

  loadModel: (projectId: string, model: UmlModel) => void;
  selectClass: (id: string | null) => void;
  selectRelationship: (id: string | null) => void;

  applyCreateClass: (op: { classId: string; name: string; position: { x: number; y: number } }) => void;
  applyRenameClass: (op: { classId: string; name: string }) => void;
  applyMoveClass: (op: { classId: string; position: { x: number; y: number } }) => void;
  applyDeleteClass: (op: { classId: string }) => void;

  applyAddAttribute: (
    op: { classId: string; attributeId: string; name: string; type: UmlDataType } & Partial<
      Pick<UmlAttribute, 'isPrimaryKey' | 'nullable' | 'defaultValue'>
    >,
  ) => void;
  applyUpdateAttribute: (
    op: { classId: string; attributeId: string } & Partial<Omit<UmlAttribute, 'id'>>,
  ) => void;
  applyRemoveAttribute: (op: { classId: string; attributeId: string }) => void;

  applyCreateRelationship: (op: {
    relationshipId: string;
    sourceClassId: string;
    targetClassId: string;
    type: RelationshipType;
    sourceMultiplicity: Multiplicity;
    targetMultiplicity: Multiplicity;
  }) => void;
  applyUpdateRelationship: (op: { relationshipId: string; type: RelationshipType }) => void;
  applySetMultiplicity: (op: {
    relationshipId: string;
    sourceMultiplicity: Multiplicity;
    targetMultiplicity: Multiplicity;
  }) => void;
  applyDeleteRelationship: (op: { relationshipId: string }) => void;
}

type UmlRelationshipState = UmlModel['relationships'][number];

export const useUmlStore = create<UmlState>((set) => ({
  projectId: null,
  revision: 0,
  classes: [],
  relationships: [],
  selectedClassId: null,
  selectedRelationshipId: null,

  loadModel: (projectId, model) =>
    set({
      projectId,
      revision: model.revision,
      classes: model.classes,
      relationships: model.relationships,
      selectedClassId: null,
      selectedRelationshipId: null,
    }),

  selectClass: (id) => set({ selectedClassId: id, selectedRelationshipId: null }),
  selectRelationship: (id) => set({ selectedRelationshipId: id, selectedClassId: null }),

  applyCreateClass: ({ classId, name, position }) =>
    set((state) => ({
      classes: [...state.classes, { id: classId, name, position, attributes: [] }],
      selectedClassId: classId,
      selectedRelationshipId: null,
    })),

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
      relationships: state.relationships.filter(
        (r) => r.sourceClassId !== classId && r.targetClassId !== classId,
      ),
      selectedClassId: state.selectedClassId === classId ? null : state.selectedClassId,
    })),

  applyAddAttribute: ({ classId, attributeId, name, type, isPrimaryKey, nullable, defaultValue }) =>
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? {
              ...c,
              attributes: [
                ...c.attributes,
                {
                  id: attributeId,
                  name,
                  type,
                  isPrimaryKey: isPrimaryKey ?? false,
                  nullable: nullable ?? true,
                  defaultValue,
                },
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

  applyCreateRelationship: (op) =>
    set((state) => ({
      relationships: [
        ...state.relationships,
        {
          id: op.relationshipId,
          sourceClassId: op.sourceClassId,
          targetClassId: op.targetClassId,
          type: op.type,
          sourceMultiplicity: op.sourceMultiplicity,
          targetMultiplicity: op.targetMultiplicity,
        },
      ],
      selectedRelationshipId: op.relationshipId,
      selectedClassId: null,
    })),

  applyUpdateRelationship: ({ relationshipId, type }) =>
    set((state) => ({
      relationships: state.relationships.map((r) => (r.id === relationshipId ? { ...r, type } : r)),
    })),

  applySetMultiplicity: ({ relationshipId, sourceMultiplicity, targetMultiplicity }) =>
    set((state) => ({
      relationships: state.relationships.map((r) =>
        r.id === relationshipId ? { ...r, sourceMultiplicity, targetMultiplicity } : r,
      ),
    })),

  applyDeleteRelationship: ({ relationshipId }) =>
    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== relationshipId),
      selectedRelationshipId: state.selectedRelationshipId === relationshipId ? null : state.selectedRelationshipId,
    })),
}));
