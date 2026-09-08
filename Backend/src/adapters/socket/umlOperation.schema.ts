import { z } from 'zod';
import { UML_DATA_TYPES } from '../../domain/entities';

const uuid = z.string().uuid();
const position = z.object({ x: z.number(), y: z.number() });
const relationshipType = z.enum(['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY']);
const multiplicity = z.enum(['1', 'N']);

export const umlOperationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('CREATE_CLASS'), classId: uuid, name: z.string().min(1), position }),
  z.object({ operation: z.literal('RENAME_CLASS'), classId: uuid, name: z.string().min(1) }),
  z.object({ operation: z.literal('MOVE_ELEMENT'), classId: uuid, position }),
  z.object({ operation: z.literal('DELETE_CLASS'), classId: uuid }),
  z.object({
    operation: z.literal('ADD_ATTRIBUTE'),
    classId: uuid,
    attributeId: uuid,
    name: z.string().min(1),
    type: z.enum(UML_DATA_TYPES),
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
    defaultValue: z.string().optional(),
  }),
  z.object({
    operation: z.literal('UPDATE_ATTRIBUTE'),
    classId: uuid,
    attributeId: uuid,
    name: z.string().min(1).optional(),
    type: z.enum(UML_DATA_TYPES).optional(),
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
    defaultValue: z.string().optional(),
  }),
  z.object({ operation: z.literal('REMOVE_ATTRIBUTE'), classId: uuid, attributeId: uuid }),
  z.object({
    operation: z.literal('CREATE_RELATIONSHIP'),
    relationshipId: uuid,
    sourceClassId: uuid,
    targetClassId: uuid,
    type: relationshipType,
    sourceMultiplicity: multiplicity,
    targetMultiplicity: multiplicity,
  }),
  z.object({ operation: z.literal('UPDATE_RELATIONSHIP'), relationshipId: uuid, type: relationshipType }),
  z.object({
    operation: z.literal('SET_MULTIPLICITY'),
    relationshipId: uuid,
    sourceMultiplicity: multiplicity,
    targetMultiplicity: multiplicity,
  }),
  z.object({ operation: z.literal('DELETE_RELATIONSHIP'), relationshipId: uuid }),
]);
