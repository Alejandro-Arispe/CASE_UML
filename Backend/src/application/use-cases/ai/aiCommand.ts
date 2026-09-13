import { z } from 'zod';
import { MULTIPLICITIES, RELATIONSHIP_KINDS, UML_DATA_TYPES } from '../../../domain/entities';

// Comandos que la IA puede producir (secciones 28-29). A diferencia de
// UmlOperationInput (seccion 22), estos referencian clases/atributos por
// NOMBRE, no por UUID: es mas natural para un LLM y evita depender de que
// invente o copie identificadores correctamente. `resolveAiCommands` los
// traduce a operaciones reales con IDs antes de aplicarlas.

// Tolerancia a variantes que un LLM (o una foto) suele usar: "N", "*",
// "1..n", "0..n", "many".
const multiplicitySchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const compact = value.trim().toLowerCase().replace(/\s+/g, '');
  if (compact === 'many') return '0..*';
  const normalized = compact.replace(/n|-1/g, '*');
  if (normalized === '*' || normalized === '0..*') return '0..*';
  if (normalized === '1..*') return '1..*';
  if (normalized === '0..1') return '0..1';
  if (normalized === '1' || normalized === '1..1') return '1';
  return value;
}, z.enum(MULTIPLICITIES));

const kindSchema = z.enum(RELATIONSHIP_KINDS);
const dataTypeSchema = z.enum(UML_DATA_TYPES);
const name = z.string().trim().min(1).max(120);
// Posicion sugerida en un lienzo de 0 a 1000 (para imagenes: donde estaba
// la clase en la foto; para texto: una distribucion legible).
const coordinate = z.number().finite().min(0).max(1000).optional();

export const aiCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE_CLASS'), className: name, x: coordinate, y: coordinate }),
  z.object({ action: z.literal('RENAME_CLASS'), className: name, newName: name }),
  z.object({ action: z.literal('DELETE_CLASS'), className: name }),
  z.object({
    action: z.literal('ADD_ATTRIBUTE'),
    className: name,
    attributeName: name,
    dataType: dataTypeSchema,
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
    defaultValue: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('UPDATE_ATTRIBUTE'),
    className: name,
    attributeName: name,
    newAttributeName: name.optional(),
    dataType: dataTypeSchema.optional(),
    isPrimaryKey: z.boolean().optional(),
    nullable: z.boolean().optional(),
  }),
  z.object({ action: z.literal('REMOVE_ATTRIBUTE'), className: name, attributeName: name }),
  z.object({
    action: z.literal('CREATE_RELATIONSHIP'),
    sourceClassName: name,
    targetClassName: name,
    relationshipKind: kindSchema.default('ASSOCIATION'),
    sourceMultiplicity: multiplicitySchema.default('1'),
    targetMultiplicity: multiplicitySchema.default('0..*'),
    relationshipName: z.string().trim().max(120).optional(),
    associationClassName: name.optional(),
  }),
  z.object({
    action: z.literal('UPDATE_RELATIONSHIP'),
    sourceClassName: name,
    targetClassName: name,
    relationshipName: z.string().trim().max(120).optional(),
    relationshipKind: kindSchema.optional(),
    sourceMultiplicity: multiplicitySchema.optional(),
    targetMultiplicity: multiplicitySchema.optional(),
    associationClassName: name.optional(),
  }),
  z.object({
    action: z.literal('SET_MULTIPLICITY'),
    sourceClassName: name,
    targetClassName: name,
    relationshipName: z.string().trim().max(120).optional(),
    sourceMultiplicity: multiplicitySchema,
    targetMultiplicity: multiplicitySchema,
  }),
  z.object({
    action: z.literal('DELETE_RELATIONSHIP'),
    sourceClassName: name,
    targetClassName: name,
    relationshipName: z.string().trim().max(120).optional(),
  }),
]);

export type AiCommand = z.infer<typeof aiCommandSchema>;
