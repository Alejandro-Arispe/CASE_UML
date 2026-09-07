import { z } from 'zod';
import { UML_DATA_TYPES } from '../../../domain/entities';

const attributeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'El atributo debe tener un nombre'),
  type: z.enum(UML_DATA_TYPES),
  isPrimaryKey: z.boolean(),
  nullable: z.boolean(),
  defaultValue: z.string().optional(),
});

const classSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'La clase debe tener un nombre'),
  position: z.object({ x: z.number(), y: z.number() }),
  attributes: z.array(attributeSchema),
});

const relationshipSchema = z.object({
  id: z.string().uuid(),
  sourceClassId: z.string().uuid(),
  targetClassId: z.string().uuid(),
  type: z.enum(['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY']),
  sourceMultiplicity: z.enum(['1', 'N']),
  targetMultiplicity: z.enum(['1', 'N']),
});

export const saveUmlModelSchema = z.object({
  classes: z.array(classSchema),
  relationships: z.array(relationshipSchema),
});
