import { z } from 'zod';
import { UML_DATA_TYPES } from '../../../domain/entities';

// Comandos que la IA puede producir (secciones 28-29). A diferencia de
// UmlOperationInput (seccion 22), estos referencian clases/atributos por
// NOMBRE, no por UUID: es mas natural para un LLM y evita depender de que
// invente o copie identificadores correctamente (seccion 18: la
// normalizacion/consistencia de IDs es responsabilidad deterministica del
// backend, no de la IA). `resolveAiCommands` los traduce a operaciones
// reales con IDs antes de aplicarlas con el mismo motor de la Fase 6.
const relationshipTypeEnum = z.enum(['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY']);
const multiplicityEnum = z.enum(['1', 'N']);
const dataTypeEnum = z.enum(UML_DATA_TYPES);

export const aiCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE_CLASS'), className: z.string().min(1) }),
  z.object({ action: z.literal('RENAME_CLASS'), className: z.string().min(1), newName: z.string().min(1) }),
  z.object({ action: z.literal('DELETE_CLASS'), className: z.string().min(1) }),
  z.object({
    action: z.literal('ADD_ATTRIBUTE'),
    className: z.string().min(1),
    attributeName: z.string().min(1),
    dataType: dataTypeEnum,
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
    defaultValue: z.string().optional(),
  }),
  z.object({
    action: z.literal('UPDATE_ATTRIBUTE'),
    className: z.string().min(1),
    attributeName: z.string().min(1),
    newAttributeName: z.string().min(1).optional(),
    dataType: dataTypeEnum.optional(),
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
  }),
  z.object({ action: z.literal('REMOVE_ATTRIBUTE'), className: z.string().min(1), attributeName: z.string().min(1) }),
  z.object({
    action: z.literal('CREATE_RELATIONSHIP'),
    sourceClassName: z.string().min(1),
    targetClassName: z.string().min(1),
    relationshipType: relationshipTypeEnum,
    sourceMultiplicity: multiplicityEnum,
    targetMultiplicity: multiplicityEnum,
  }),
  z.object({
    action: z.literal('UPDATE_RELATIONSHIP'),
    sourceClassName: z.string().min(1),
    targetClassName: z.string().min(1),
    relationshipType: relationshipTypeEnum,
  }),
  z.object({
    action: z.literal('SET_MULTIPLICITY'),
    sourceClassName: z.string().min(1),
    targetClassName: z.string().min(1),
    sourceMultiplicity: multiplicityEnum,
    targetMultiplicity: multiplicityEnum,
  }),
  z.object({ action: z.literal('DELETE_RELATIONSHIP'), sourceClassName: z.string().min(1), targetClassName: z.string().min(1) }),
]);

export type AiCommand = z.infer<typeof aiCommandSchema>;
