import { z } from 'zod';
import { MULTIPLICITIES, RELATIONSHIP_KINDS, UML_DATA_TYPES } from '../../domain/entities';

const uuid = z.string().uuid();
const position = z.object({ x: z.number().finite(), y: z.number().finite() });
const relationshipKind = z.enum(RELATIONSHIP_KINDS);
const multiplicity = z.enum(MULTIPLICITIES);
const className = z.string().trim().min(1).max(120);
const attributeName = z.string().trim().min(1).max(120);

export const umlOperationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('CREATE_CLASS'), classId: uuid, name: className, position }),
  z.object({ operation: z.literal('RENAME_CLASS'), classId: uuid, name: className }),
  z.object({ operation: z.literal('MOVE_ELEMENT'), classId: uuid, position }),
  z.object({ operation: z.literal('DELETE_CLASS'), classId: uuid }),
  z.object({
    operation: z.literal('ADD_ATTRIBUTE'),
    classId: uuid,
    attributeId: uuid,
    name: attributeName,
    type: z.enum(UML_DATA_TYPES),
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
    defaultValue: z.string().max(500).optional(),
  }),
  z.object({
    operation: z.literal('UPDATE_ATTRIBUTE'),
    classId: uuid,
    attributeId: uuid,
    name: attributeName.optional(),
    type: z.enum(UML_DATA_TYPES).optional(),
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
    defaultValue: z.string().max(500).optional(),
  }),
  z.object({ operation: z.literal('REMOVE_ATTRIBUTE'), classId: uuid, attributeId: uuid }),
  z.object({
    operation: z.literal('CREATE_RELATIONSHIP'),
    relationshipId: uuid,
    sourceClassId: uuid,
    targetClassId: uuid,
    kind: relationshipKind,
    sourceMultiplicity: multiplicity,
    targetMultiplicity: multiplicity,
    name: z.string().max(120).optional(),
    associationClassId: uuid.optional(),
  }),
  z.object({
    operation: z.literal('UPDATE_RELATIONSHIP'),
    relationshipId: uuid,
    kind: relationshipKind.optional(),
    sourceClassId: uuid.optional(),
    targetClassId: uuid.optional(),
    sourceMultiplicity: multiplicity.optional(),
    targetMultiplicity: multiplicity.optional(),
    name: z.string().max(120).optional(),
    associationClassId: uuid.nullable().optional(),
  }),
  z.object({
    operation: z.literal('SET_MULTIPLICITY'),
    relationshipId: uuid,
    sourceMultiplicity: multiplicity,
    targetMultiplicity: multiplicity,
  }),
  z.object({ operation: z.literal('DELETE_RELATIONSHIP'), relationshipId: uuid }),
]);
