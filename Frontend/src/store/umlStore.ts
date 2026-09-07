import { create } from 'zustand';
import type {
  Multiplicity,
  RelationshipType,
  UmlAttribute,
  UmlClass,
  UmlDataType,
  UmlModel,
  UmlRelationship,
} from '../types/uml';

// Estado canonico del diagrama UML, independiente de React Flow (seccion 6):
// el canvas es una vista derivada de este store, nunca la fuente de verdad.
// `version` sube en cada mutacion y solo sirve para disparar el autoguardado
// (debounce) desde el componente del editor.
interface UmlState {
  projectId: string | null;
  revision: number;
  classes: UmlClass[];
  relationships: UmlRelationship[];
  selectedClassId: string | null;
  selectedRelationshipId: string | null;
  version: number;

  loadModel: (projectId: string, model: UmlModel) => void;
  selectClass: (id: string | null) => void;
  selectRelationship: (id: string | null) => void;

  addClass: (position: { x: number; y: number }) => string;
  renameClass: (classId: string, name: string) => void;
  moveClass: (classId: string, position: { x: number; y: number }) => void;
  removeClass: (classId: string) => void;

  addAttribute: (classId: string) => void;
  updateAttribute: (classId: string, attributeId: string, patch: Partial<UmlAttribute>) => void;
  removeAttribute: (classId: string, attributeId: string) => void;

  addRelationship: (sourceClassId: string, targetClassId: string) => void;
  updateRelationship: (relationshipId: string, patch: Partial<UmlRelationship>) => void;
  removeRelationship: (relationshipId: string) => void;
}

function newId(): string {
  return crypto.randomUUID();
}

export const useUmlStore = create<UmlState>((set) => ({
  projectId: null,
  revision: 0,
  classes: [],
  relationships: [],
  selectedClassId: null,
  selectedRelationshipId: null,
  version: 0,

  loadModel: (projectId, model) =>
    set({
      projectId,
      revision: model.revision,
      classes: model.classes,
      relationships: model.relationships,
      selectedClassId: null,
      selectedRelationshipId: null,
      version: 0,
    }),

  selectClass: (id) => set({ selectedClassId: id, selectedRelationshipId: null }),
  selectRelationship: (id) => set({ selectedRelationshipId: id, selectedClassId: null }),

  addClass: (position) => {
    const id = newId();
    const klass: UmlClass = { id, name: 'NuevaClase', position, attributes: [] };
    set((state) => ({
      classes: [...state.classes, klass],
      selectedClassId: id,
      version: state.version + 1,
    }));
    return id;
  },

  renameClass: (classId, name) =>
    set((state) => ({
      classes: state.classes.map((c) => (c.id === classId ? { ...c, name } : c)),
      version: state.version + 1,
    })),

  moveClass: (classId, position) =>
    set((state) => ({
      classes: state.classes.map((c) => (c.id === classId ? { ...c, position } : c)),
      version: state.version + 1,
    })),

  removeClass: (classId) =>
    set((state) => ({
      classes: state.classes.filter((c) => c.id !== classId),
      // Sin cascada compleja: al borrar una clase se borran tambien las
      // relaciones que la usaban, para no dejar referencias colgantes.
      relationships: state.relationships.filter(
        (r) => r.sourceClassId !== classId && r.targetClassId !== classId,
      ),
      selectedClassId: state.selectedClassId === classId ? null : state.selectedClassId,
      version: state.version + 1,
    })),

  addAttribute: (classId) => {
    const attribute: UmlAttribute = {
      id: newId(),
      name: 'atributo',
      type: 'String' as UmlDataType,
      isPrimaryKey: false,
      nullable: true,
    };
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId ? { ...c, attributes: [...c.attributes, attribute] } : c,
      ),
      version: state.version + 1,
    }));
  },

  updateAttribute: (classId, attributeId, patch) =>
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? {
              ...c,
              attributes: c.attributes.map((a) => (a.id === attributeId ? { ...a, ...patch } : a)),
            }
          : c,
      ),
      version: state.version + 1,
    })),

  removeAttribute: (classId, attributeId) =>
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId ? { ...c, attributes: c.attributes.filter((a) => a.id !== attributeId) } : c,
      ),
      version: state.version + 1,
    })),

  addRelationship: (sourceClassId, targetClassId) => {
    const relationship: UmlRelationship = {
      id: newId(),
      sourceClassId,
      targetClassId,
      type: 'ONE_TO_MANY' as RelationshipType,
      sourceMultiplicity: '1' as Multiplicity,
      targetMultiplicity: 'N' as Multiplicity,
    };
    set((state) => ({
      relationships: [...state.relationships, relationship],
      selectedRelationshipId: relationship.id,
      version: state.version + 1,
    }));
  },

  updateRelationship: (relationshipId, patch) =>
    set((state) => ({
      relationships: state.relationships.map((r) => (r.id === relationshipId ? { ...r, ...patch } : r)),
      version: state.version + 1,
    })),

  removeRelationship: (relationshipId) =>
    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== relationshipId),
      selectedRelationshipId: state.selectedRelationshipId === relationshipId ? null : state.selectedRelationshipId,
      version: state.version + 1,
    })),
}));
