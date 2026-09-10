import { UML_DATA_TYPES, UmlModel } from '../entities';
import { toCamelCase, toPascalCase } from '../naming';
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
      // La clave de duplicado es el identificador Java que el generador
      // realmente va a producir (toPascalCase), no el texto tal cual lo
      // escribio el usuario: "Cliente_1" y "cliente-1" son strings
      // distintos pero generan la misma clase "Cliente1", y esa colision
      // solo se detecta si se compara con la misma normalizacion.
      const key = toPascalCase(name);
      if (seenClassNames.has(key)) {
        issues.push({
          code: 'DUPLICATE_CLASS_NAME',
          elementType: 'CLASS',
          elementId: klass.id,
          message: `Nombre de clase duplicado: "${name}" genera el mismo identificador que otra clase ("${key}")`,
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

    // Nombres de atributo duplicados DENTRO de esta clase (reseteado por
    // clase, a diferencia de seenClassNames que es global al modelo): el
    // generador mapea el nombre a un fieldName con toCamelCase, asi que
    // "Email" y "email" en la misma clase producen el mismo campo Java.
    const seenAttributeNames = new Map<string, string>();

    for (const attr of klass.attributes) {
      checkDuplicateId(attr.id, 'ATTRIBUTE', 'atributo');

      const attrName = attr.name.trim();
      if (!attrName) {
        issues.push({
          code: 'ATTRIBUTE_WITHOUT_NAME',
          elementType: 'ATTRIBUTE',
          elementId: attr.id,
          message: `Atributo sin nombre en "${name || klass.id}"`,
        });
      } else {
        const attrKey = toCamelCase(attrName);
        if (seenAttributeNames.has(attrKey)) {
          issues.push({
            code: 'DUPLICATE_ATTRIBUTE_NAME',
            elementType: 'ATTRIBUTE',
            elementId: attr.id,
            message: `Atributo duplicado en "${name || klass.id}": "${attrName}" genera el mismo campo que otro atributo ("${attrKey}")`,
          });
        } else {
          seenAttributeNames.set(attrKey, attr.id);
        }
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

    // M:N de una clase consigo misma: el generador arma un @JoinTable cuyo
    // joinColumnName e inverseJoinColumnName salen identicos (mismo
    // tableName de origen y destino), lo que Hibernate rechaza al arrancar.
    if (rel.type === 'MANY_TO_MANY' && rel.sourceClassId === rel.targetClassId) {
      issues.push({
        code: 'RELATIONSHIP_SELF_REFERENCE_MANY_TO_MANY',
        elementType: 'RELATIONSHIP',
        elementId: rel.id,
        message: 'Una relacion Muchos a Muchos no puede ser de una clase consigo misma',
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
