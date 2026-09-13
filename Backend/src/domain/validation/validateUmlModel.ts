import { MULTIPLICITIES, RELATIONSHIP_KINDS, UML_DATA_TYPES, UmlModel } from '../entities';
import { toCamelCase, toPascalCase } from '../naming';
import { toValidationResult, ValidationIssue, ValidationResult } from './ValidationIssue';

// Validador estructural del modelo UML completo (seccion 17): detecta
// problemas que ninguna entidad puede ver por si sola (nombres duplicados,
// relaciones colgantes, IDs repetidos, herencia circular). Las reglas que
// dependen de COMO se genera el backend (claves primarias, choques de
// columnas/FK, palabras reservadas) viven en generator/planGeneration.ts,
// porque necesitan calcular exactamente los nombres que se van a generar.
export function validateUmlModel(model: UmlModel): ValidationResult {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  const seenClassNames = new Map<string, string>();

  function error(issue: Omit<ValidationIssue, 'severity'>) {
    issues.push({ ...issue, severity: 'ERROR' });
  }

  function checkDuplicateId(id: string, elementType: ValidationIssue['elementType'], label: string) {
    if (seenIds.has(id)) {
      error({ code: 'DUPLICATE_ID', elementType, elementId: id, message: `ID duplicado en ${label}: ${id}` });
    } else {
      seenIds.add(id);
    }
  }

  for (const klass of model.classes) {
    checkDuplicateId(klass.id, 'CLASS', 'clase');

    const name = klass.name.trim();
    if (!name) {
      error({ code: 'CLASS_WITHOUT_NAME', elementType: 'CLASS', elementId: klass.id, message: 'La clase no tiene nombre' });
    } else {
      // La clave de duplicado es el identificador Java que el generador
      // realmente va a producir (toPascalCase), no el texto tal cual lo
      // escribio el usuario: "Cliente_1" y "cliente-1" generan "Cliente1".
      const key = toPascalCase(name);
      if (seenClassNames.has(key)) {
        error({
          code: 'DUPLICATE_CLASS_NAME',
          elementType: 'CLASS',
          elementId: klass.id,
          message: `Nombre de clase duplicado: "${name}" genera el mismo identificador que otra clase ("${key}")`,
        });
      } else {
        seenClassNames.set(key, klass.id);
      }
    }

    const seenAttributeNames = new Map<string, string>();
    for (const attr of klass.attributes) {
      checkDuplicateId(attr.id, 'ATTRIBUTE', 'atributo');

      const attrName = attr.name.trim();
      if (!attrName) {
        error({
          code: 'ATTRIBUTE_WITHOUT_NAME',
          elementType: 'ATTRIBUTE',
          elementId: attr.id,
          message: `Atributo sin nombre en "${name || klass.id}"`,
        });
      } else {
        const attrKey = toCamelCase(attrName);
        if (seenAttributeNames.has(attrKey)) {
          error({
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
        error({
          code: 'ATTRIBUTE_WITHOUT_TYPE',
          elementType: 'ATTRIBUTE',
          elementId: attr.id,
          message: `Atributo "${attr.name || attr.id}" con tipo invalido`,
        });
      }
    }
  }

  const classIds = new Set(model.classes.map((c) => c.id));
  const classNameById = new Map(model.classes.map((c) => [c.id, c.name]));
  const parentsByChild = new Map<string, string[]>();

  for (const rel of model.relationships) {
    checkDuplicateId(rel.id, 'RELATIONSHIP', 'relacion');

    if (!classIds.has(rel.sourceClassId) || !classIds.has(rel.targetClassId)) {
      error({
        code: 'RELATIONSHIP_TO_UNKNOWN_CLASS',
        elementType: 'RELATIONSHIP',
        elementId: rel.id,
        message: 'La relacion referencia una clase inexistente',
      });
      continue;
    }

    if (!RELATIONSHIP_KINDS.includes(rel.kind)) {
      error({ code: 'INVALID_RELATIONSHIP_KIND', elementType: 'RELATIONSHIP', elementId: rel.id, message: 'Tipo de relacion invalido' });
    }

    if (!MULTIPLICITIES.includes(rel.sourceMultiplicity) || !MULTIPLICITIES.includes(rel.targetMultiplicity)) {
      error({
        code: 'INVALID_MULTIPLICITY',
        elementType: 'RELATIONSHIP',
        elementId: rel.id,
        message: `Multiplicidad invalida en la relacion (valores permitidos: ${MULTIPLICITIES.join(', ')})`,
      });
    }

    if (rel.associationClassId) {
      const invalid =
        rel.kind !== 'ASSOCIATION' ||
        !classIds.has(rel.associationClassId) ||
        rel.associationClassId === rel.sourceClassId ||
        rel.associationClassId === rel.targetClassId;
      if (invalid) {
        error({
          code: 'INVALID_ASSOCIATION_CLASS',
          elementType: 'RELATIONSHIP',
          elementId: rel.id,
          message: 'La clase asociacion debe ser una clase existente, distinta de los extremos, sobre una asociacion',
        });
      }
    }

    if (rel.kind === 'GENERALIZATION') {
      parentsByChild.set(rel.sourceClassId, [...(parentsByChild.get(rel.sourceClassId) ?? []), rel.targetClassId]);
    }
  }

  // JPA solo admite un padre por entidad.
  for (const [childId, parents] of parentsByChild) {
    if (parents.length > 1) {
      error({
        code: 'MULTIPLE_INHERITANCE',
        elementType: 'CLASS',
        elementId: childId,
        message: `"${classNameById.get(childId)}" hereda de mas de una clase; solo se admite un padre por clase`,
      });
    }
  }

  // Ciclos de herencia (A hereda de B y B de A, directa o indirectamente).
  for (const childId of parentsByChild.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = childId;
    while (current && parentsByChild.has(current)) {
      if (visited.has(current)) {
        error({
          code: 'INHERITANCE_CYCLE',
          elementType: 'CLASS',
          elementId: childId,
          message: `La herencia de "${classNameById.get(childId)}" forma un ciclo`,
        });
        break;
      }
      visited.add(current);
      current = parentsByChild.get(current)?.[0];
    }
  }

  return toValidationResult(issues);
}
