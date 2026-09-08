import { UML_DATA_TYPES, UmlModel } from '../entities';
import { ValidationIssue, ValidationResult } from './ValidationIssue';

const VALID_MULTIPLICITIES = ['1', 'N'];

// Validador del modelo UML completo (seccion 17): corre antes del
// generador y detecta problemas que ninguna entidad puede ver por si sola
// (nombres duplicados, relaciones colgantes, IDs repetidos, entidades sin
// PK). Las invariantes de una sola entidad (ej. nombre no vacio al crearla)
// ya las cubren las factories de dominio; esto valida el GRAFO completo.
// No genera nada invalido en silencio: si hay issues, el modelo no es
// valido para generar, aunque pueda seguir existiendo visualmente.
export function validateUmlModel(model: UmlModel): ValidationResult {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  const seenClassNames = new Map<string, string>();

  function checkDuplicateId(id: string, elementType: ValidationIssue['elementType'], label: string) {
    if (seenIds.has(id)) {
      issues.push({ code: 'DUPLICATE_ID', elementType, elementId: id, message: `ID duplicado en ${label}: ${id}` });
    } else {
      seenIds.add(id);
    }
  }

  for (const klass of model.classes) {
    checkDuplicateId(klass.id, 'CLASS', 'clase');

    const name = klass.name.trim();
    if (!name) {
      issues.push({ code: 'CLASS_WITHOUT_NAME', elementType: 'CLASS', elementId: klass.id, message: 'La clase no tiene nombre' });
    } else {
      const key = name.toLowerCase();
      if (seenClassNames.has(key)) {
        issues.push({
          code: 'DUPLICATE_CLASS_NAME',
          elementType: 'CLASS',
          elementId: klass.id,
          message: `Nombre de clase duplicado: "${name}"`,
        });
      } else {
        seenClassNames.set(key, klass.id);
      }
    }

    // Seccion 16: sin PK el modelo puede seguir existiendo, pero no es
    // valido para generar.
    if (!klass.attributes.some((a) => a.isPrimaryKey)) {
      issues.push({
        code: 'ENTITY_WITHOUT_PRIMARY_KEY',
        elementType: 'CLASS',
        elementId: klass.id,
        message: `La clase "${name || klass.id}" no tiene clave primaria`,
      });
    }

    for (const attr of klass.attributes) {
      checkDuplicateId(attr.id, 'ATTRIBUTE', 'atributo');

      if (!attr.name.trim()) {
        issues.push({
          code: 'ATTRIBUTE_WITHOUT_NAME',
          elementType: 'ATTRIBUTE',
          elementId: attr.id,
          message: `Atributo sin nombre en "${name || klass.id}"`,
        });
      }

      if (!UML_DATA_TYPES.includes(attr.type)) {
        issues.push({
          code: 'ATTRIBUTE_WITHOUT_TYPE',
          elementType: 'ATTRIBUTE',
          elementId: attr.id,
          message: `Atributo "${attr.name || attr.id}" con tipo invalido`,
        });
      }
    }
  }

  const classIds = new Set(model.classes.map((c) => c.id));

  for (const rel of model.relationships) {
    checkDuplicateId(rel.id, 'RELATIONSHIP', 'relacion');

    if (!classIds.has(rel.sourceClassId) || !classIds.has(rel.targetClassId)) {
      issues.push({
        code: 'RELATIONSHIP_TO_UNKNOWN_CLASS',
        elementType: 'RELATIONSHIP',
        elementId: rel.id,
        message: 'La relacion referencia una clase inexistente',
      });
    }

    if (!VALID_MULTIPLICITIES.includes(rel.sourceMultiplicity) || !VALID_MULTIPLICITIES.includes(rel.targetMultiplicity)) {
      issues.push({
        code: 'INVALID_MULTIPLICITY',
        elementType: 'RELATIONSHIP',
        elementId: rel.id,
        message: 'Multiplicidad invalida en la relacion (debe ser "1" o "N")',
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
