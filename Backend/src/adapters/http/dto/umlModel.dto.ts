import { z } from 'zod';
import { MULTIPLICITIES, RELATIONSHIP_KINDS, UML_DATA_TYPES } from '../../../domain/entities';

// Los IDs deben ser UUID: el cliente reasigna IDs nuevos al importar (un
// XMI de Enterprise Architect trae ids "EAID_..." y, ademas, los ids son
// clave primaria global, asi que reusarlos entre proyectos colisionaria).
const attributeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'El atributo debe tener un nombre').max(120),
  type: z.enum(UML_DATA_TYPES),
  isPrimaryKey: z.boolean(),
  nullable: z.boolean(),
  defaultValue: z.string().max(500).optional(),
});

const classSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'La clase debe tener un nombre').max(120),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  attributes: z.array(attributeSchema).max(500),
});

const relationshipSchema = z.object({
  id: z.string().uuid(),
  sourceClassId: z.string().uuid(),
  targetClassId: z.string().uuid(),
  kind: z.enum(RELATIONSHIP_KINDS),
  sourceMultiplicity: z.enum(MULTIPLICITIES),
  targetMultiplicity: z.enum(MULTIPLICITIES),
  name: z.string().max(120).optional(),
  associationClassId: z.string().uuid().optional(),
});

export const saveUmlModelSchema = z.object({
  classes: z.array(classSchema).max(1000),
  relationships: z.array(relationshipSchema).max(5000),
});
