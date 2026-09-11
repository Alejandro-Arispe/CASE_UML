import { UML_DATA_TYPES } from '../../types/uml';
import type { Multiplicity, RelationshipType, UmlAttribute, UmlClass, UmlDataType, UmlRelationship } from '../../types/uml';

// Importar/exportar el modelo como XMI (XML Metadata Interchange), el
// formato estandar de OMG para intercambiar modelos UML entre herramientas
// CASE (Enterprise Architect, Visual Paradigm, StarUML) -- no JSON crudo.
// El objeto interno del modelo (classes/relationships) sigue siendo la
// fuente de verdad en toda la app; XMI es solo el formato de archivo en el
// borde de import/export, igual que en cualquier herramienta CASE real.
//
// Se usan elementos reales de la metamodel UML (uml:Class, ownedAttribute,
// uml:Association con ownedEnd) para que un .xmi exportado sea reconocible
// por otras herramientas. Lo unico que el estandar no cubre (la posicion en
// el canvas) se guarda en atributos de un namespace propio ("caseuml:"),
// que cualquier otra herramienta simplemente ignora al no reconocerlos.

const XMI_NS = 'http://schema.omg.org/spec/XMI/2.1';
const UML_NS = 'http://schema.omg.org/spec/UML/2.1';
const CASEUML_NS = 'http://case-uml.local/extension';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function multiplicityXml(m: Multiplicity): string {
  return m === '1'
    ? [
        '        <lowerValue xmi:type="uml:LiteralInteger" value="1"/>',
        '        <upperValue xmi:type="uml:LiteralInteger" value="1"/>',
      ].join('\n')
    : [
        '        <lowerValue xmi:type="uml:LiteralInteger" value="0"/>',
        '        <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="*"/>',
      ].join('\n');
}

export function exportToXmi(classes: UmlClass[], relationships: UmlRelationship[], modelName: string): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<xmi:XMI xmi:version="2.1" xmlns:xmi="${XMI_NS}" xmlns:uml="${UML_NS}" xmlns:caseuml="${CASEUML_NS}">`,
    `  <uml:Model xmi:type="uml:Model" xmi:id="model" name="${escapeXml(modelName)}">`,
  ];

  for (const klass of classes) {
    lines.push(
      `    <packagedElement xmi:type="uml:Class" xmi:id="${klass.id}" name="${escapeXml(klass.name)}" ` +
        `caseuml:x="${klass.position.x}" caseuml:y="${klass.position.y}">`,
    );
    for (const attr of klass.attributes) {
      lines.push(`      <ownedAttribute xmi:id="${attr.id}" name="${escapeXml(attr.name)}" isID="${attr.isPrimaryKey}">`);
      lines.push(`        <type xmi:type="uml:PrimitiveType" name="${attr.type}"/>`);
      lines.push(`        <lowerValue xmi:type="uml:LiteralInteger" value="${attr.nullable ? 0 : 1}"/>`);
      lines.push('        <upperValue xmi:type="uml:LiteralInteger" value="1"/>');
      if (attr.defaultValue !== undefined) {
        lines.push(`        <defaultValue xmi:type="uml:LiteralString" value="${escapeXml(attr.defaultValue)}"/>`);
      }
      lines.push('      </ownedAttribute>');
    }
    lines.push('    </packagedElement>');
  }

  for (const rel of relationships) {
    const sourceEndId = `${rel.id}_src`;
    const targetEndId = `${rel.id}_tgt`;
    lines.push(`    <packagedElement xmi:type="uml:Association" xmi:id="${rel.id}" name="${rel.type}">`);
    lines.push(`      <memberEnd xmi:idref="${sourceEndId}"/>`);
    lines.push(`      <memberEnd xmi:idref="${targetEndId}"/>`);
    lines.push(`      <ownedEnd xmi:id="${sourceEndId}" type="${rel.sourceClassId}">`);
    lines.push(multiplicityXml(rel.sourceMultiplicity));
    lines.push('      </ownedEnd>');
    lines.push(`      <ownedEnd xmi:id="${targetEndId}" type="${rel.targetClassId}">`);
    lines.push(multiplicityXml(rel.targetMultiplicity));
    lines.push('      </ownedEnd>');
    lines.push('    </packagedElement>');
  }

  lines.push('  </uml:Model>', '</xmi:XMI>');
  return lines.join('\n');
}

function isUmlDataType(value: string): value is UmlDataType {
  return (UML_DATA_TYPES as readonly string[]).includes(value);
}

function readMultiplicity(end: Element | undefined): Multiplicity {
  const upper = end?.getElementsByTagName('upperValue')[0]?.getAttribute('value');
  return upper === '1' ? '1' : 'N';
}

function multiplicityPairToType(source: Multiplicity, target: Multiplicity): RelationshipType {
  if (source === '1' && target === '1') return 'ONE_TO_ONE';
  if (source === '1' && target === 'N') return 'ONE_TO_MANY';
  if (source === 'N' && target === '1') return 'MANY_TO_ONE';
  return 'MANY_TO_MANY';
}

export interface ParsedXmiModel {
  classes: UmlClass[];
  relationships: UmlRelationship[];
}

export function parseXmiToModel(xmiText: string): ParsedXmiModel {
  const doc = new DOMParser().parseFromString(xmiText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('El archivo no es un XML/XMI valido');
  }

  const packagedElements = Array.from(doc.getElementsByTagName('packagedElement'));
  const classElements = packagedElements.filter((el) => el.getAttribute('xmi:type') === 'uml:Class');
  const associationElements = packagedElements.filter((el) => el.getAttribute('xmi:type') === 'uml:Association');

  if (classElements.length === 0 && associationElements.length === 0) {
    throw new Error('El XMI no tiene clases ni relaciones reconocibles');
  }

  const classes: UmlClass[] = classElements.map((el) => {
    const attributeElements = Array.from(el.getElementsByTagName('ownedAttribute'));
    const attributes: UmlAttribute[] = attributeElements.map((attrEl) => {
      const rawType = attrEl.getElementsByTagName('type')[0]?.getAttribute('name') ?? 'String';
      const lower = attrEl.getElementsByTagName('lowerValue')[0]?.getAttribute('value');
      const defaultValue = attrEl.getElementsByTagName('defaultValue')[0]?.getAttribute('value') ?? undefined;
      return {
        id: attrEl.getAttribute('xmi:id') ?? crypto.randomUUID(),
        name: attrEl.getAttribute('name') ?? 'atributo',
        type: isUmlDataType(rawType) ? rawType : 'String',
        isPrimaryKey: attrEl.getAttribute('isID') === 'true',
        nullable: lower !== '1',
        defaultValue,
      };
    });

    return {
      id: el.getAttribute('xmi:id') ?? crypto.randomUUID(),
      name: el.getAttribute('name') ?? 'Clase',
      position: {
        x: Number(el.getAttribute('caseuml:x') ?? 0) || 0,
        y: Number(el.getAttribute('caseuml:y') ?? 0) || 0,
      },
      attributes,
    };
  });

  const relationships: UmlRelationship[] = associationElements.map((el) => {
    const [sourceEnd, targetEnd] = Array.from(el.getElementsByTagName('ownedEnd'));
    const sourceMultiplicity = readMultiplicity(sourceEnd);
    const targetMultiplicity = readMultiplicity(targetEnd);
    return {
      id: el.getAttribute('xmi:id') ?? crypto.randomUUID(),
      sourceClassId: sourceEnd?.getAttribute('type') ?? '',
      targetClassId: targetEnd?.getAttribute('type') ?? '',
      type: multiplicityPairToType(sourceMultiplicity, targetMultiplicity),
      sourceMultiplicity,
      targetMultiplicity,
    };
  });

  return { classes, relationships };
}
