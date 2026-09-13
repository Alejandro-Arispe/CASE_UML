import { DEFAULT_MULTIPLICITIES } from '../../types/uml';
import type {
  Multiplicity,
  RelationshipKind,
  UmlAttribute,
  UmlClass,
  UmlDataType,
  UmlRelationship,
} from '../../types/uml';

// Importar/exportar el modelo como XMI 2.1 (XML Metadata Interchange), el
// formato de intercambio de modelos UML entre herramientas CASE, con la
// extension propia de Enterprise Architect (`xmi:Extension`) que es donde
// EA guarda lo que el estandar no cubre: las posiciones del diagrama, los
// conectores con sus multiplicidades y los tipos primitivos.
//
// - Importar lee tanto XMI exportado por Enterprise Architect (con sus ids
//   "EAID_...", tipos "EAJava_int", ProxyConnector para clases asociacion,
//   codificacion windows-1252) como XMI UML estandar de otras herramientas.
// - Exportar genera XMI con la misma estructura que usa EA, incluido el
//   diagrama, para poder abrirlo en Enterprise Architect.
//
// El modelo interno (classes/relationships) sigue siendo la fuente de verdad
// en toda la app; XMI es solo el formato de archivo en el borde.

const XMI_NS = 'http://schema.omg.org/spec/XMI/2.1';
const UML_NS = 'http://schema.omg.org/spec/UML/2.1';

// EA dibuja las clases mas compactas que el editor web (fuente mas chica):
// las coordenadas del diagrama de EA se escalan al importar y se reducen al
// exportar para que la distribucion se vea igual en ambas herramientas.
const EA_COORDINATE_SCALE = 2;

// ---------------------------------------------------------------------------
// Utilidades XML
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Atributo `xmi:<name>` tolerando otros prefijos/namespaces de XMI.
function xmiAttr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  const direct = el.getAttribute(`xmi:${name}`);
  if (direct !== null) return direct;
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === name && (attr.prefix === 'xmi' || attr.namespaceURI?.toUpperCase().includes('XMI'))) {
      return attr.value;
    }
  }
  return null;
}

function childrenNamed(el: Element | null | undefined, localName: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((child) => child.localName === localName);
}

function firstChild(el: Element | null | undefined, localName: string): Element | undefined {
  return childrenNamed(el, localName)[0];
}

function descendantsNamed(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', localName));
}

// Los archivos de EA suelen venir en windows-1252 (acentos, enies): se
// respeta la codificacion declarada en `<?xml ... encoding="...">` en vez de
// asumir UTF-8, que mostraria "Informaci�n".
export function decodeXmiFile(buffer: ArrayBuffer): string {
  const head = new TextDecoder('latin1').decode(buffer.slice(0, 512));
  const declared = head.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1];
  if (declared) {
    try {
      return new TextDecoder(declared).decode(buffer);
    } catch {
      // Codificacion desconocida para el navegador: se intenta UTF-8.
    }
  }
  return new TextDecoder('utf-8').decode(buffer);
}

// ---------------------------------------------------------------------------
// Tipos y multiplicidades
// ---------------------------------------------------------------------------

const TYPE_ALIASES: Record<string, UmlDataType> = {
  string: 'String', char: 'String', character: 'String', varchar: 'String', nvarchar: 'String', text: 'String',
  str: 'String', email: 'String',
  int: 'Integer', integer: 'Integer', short: 'Integer', byte: 'Integer', smallint: 'Integer', tinyint: 'Integer',
  long: 'Long', bigint: 'Long',
  float: 'Double', double: 'Double', real: 'Double',
  decimal: 'BigDecimal', bigdecimal: 'BigDecimal', numeric: 'BigDecimal', money: 'BigDecimal', currency: 'BigDecimal',
  boolean: 'Boolean', bool: 'Boolean', bit: 'Boolean',
  date: 'LocalDate', localdate: 'LocalDate',
  datetime: 'LocalDateTime', localdatetime: 'LocalDateTime', timestamp: 'LocalDateTime', time: 'LocalDateTime',
  uuid: 'UUID', guid: 'UUID',
};

function mapDataType(rawName: string | null | undefined): UmlDataType {
  if (!rawName) return 'String';
  const key = rawName.trim().toLowerCase().replace(/^java\.(lang|math|time|util)\./, '');
  return TYPE_ALIASES[key] ?? 'String';
}

function toMultiplicity(lower: string | null | undefined, upper: string | null | undefined): Multiplicity | null {
  if ((lower === null || lower === undefined) && (upper === null || upper === undefined)) return null;
  const up = (upper ?? '1').trim().toLowerCase();
  const many = up === '*' || up === 'n' || up === '-1' || Number(up) > 1;
  const lowerZero = (lower ?? (many ? '0' : '1')).trim() === '0';
  if (many) return lowerZero ? '0..*' : '1..*';
  return lowerZero ? '0..1' : '1';
}

// "1", "0..1", "*", "0..*", "1..*", "1..n", "" (sin especificar)
function parseMultiplicityString(raw: string | null | undefined): Multiplicity | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value === '*' || value.toLowerCase() === 'n') return '0..*';
  const [lower, upper] = value.includes('..') ? value.split('..') : [value, value];
  return toMultiplicity(lower, upper);
}

function multiplicityBounds(m: Multiplicity): { lower: string; upper: string } {
  switch (m) {
    case '1':
      return { lower: '1', upper: '1' };
    case '0..1':
      return { lower: '0', upper: '1' };
    case '0..*':
      return { lower: '0', upper: '*' };
    case '1..*':
      return { lower: '1', upper: '*' };
  }
}

// ---------------------------------------------------------------------------
// Importar
// ---------------------------------------------------------------------------

export interface XmiImportResult {
  classes: UmlClass[];
  relationships: UmlRelationship[];
  // Elementos omitidos o ajustados, para informar al usuario.
  warnings: string[];
}

interface RawRelationship {
  sourceId: string;
  targetId: string;
  kind: RelationshipKind;
  sourceMultiplicity: Multiplicity | null;
  targetMultiplicity: Multiplicity | null;
  name?: string;
  associationClassId?: string;
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function parseXmiToModel(xmiText: string): XmiImportResult {
  const doc = new DOMParser().parseFromString(xmiText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('El archivo no es un XML/XMI valido');
  }

  const warnings: string[] = [];
  const byId = new Map<string, Element>();
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    const id = xmiAttr(el, 'id');
    if (id && !byId.has(id)) byId.set(id, el);
  }

  // --- Extension de Enterprise Architect (si existe) -----------------------
  const extension = descendantsNamed(doc, 'Extension').find((el) =>
    (el.getAttribute('extender') ?? '').toLowerCase().includes('enterprise architect'),
  );
  const extElements = new Map<string, Element>();
  const extConnectors: Element[] = [];
  const geometryBySubject = new Map<string, string>();
  if (extension) {
    for (const el of childrenNamed(firstChild(extension, 'elements'), 'element')) {
      const idref = xmiAttr(el, 'idref');
      if (idref) extElements.set(idref, el);
    }
    extConnectors.push(...childrenNamed(firstChild(extension, 'connectors'), 'connector'));
    for (const diagram of childrenNamed(firstChild(extension, 'diagrams'), 'diagram')) {
      for (const el of childrenNamed(firstChild(diagram, 'elements'), 'element')) {
        const subject = el.getAttribute('subject');
        const geometry = el.getAttribute('geometry');
        if (subject && geometry && !geometryBySubject.has(subject)) geometryBySubject.set(subject, geometry);
      }
    }
  }

  const isProxyConnector = (id: string | null) => {
    if (!id) return false;
    const ext = extElements.get(id);
    if (ext) return xmiAttr(ext, 'type') === 'uml:ProxyConnector';
    return byId.get(id)?.getAttribute('name') === 'ProxyConnector';
  };

  // --- Clases ----------------------------------------------------------------
  const classElements = [...descendantsNamed(doc, 'packagedElement'), ...descendantsNamed(doc, 'ownedMember')].filter(
    (el) => {
      const type = xmiAttr(el, 'type');
      return (type === 'uml:Class' || type === 'uml:AssociationClass') && xmiAttr(el, 'id') && !isProxyConnector(xmiAttr(el, 'id'));
    },
  );

  if (classElements.length === 0) {
    throw new Error('El XMI no tiene clases reconocibles');
  }

  // Si el archivo trae un diagrama, se importa lo que esta dibujado en el:
  // EA suele conservar en el modelo clases sueltas o duplicadas que ya no
  // aparecen en ningun diagrama.
  const diagramHasClasses = classElements.some((el) => geometryBySubject.has(xmiAttr(el, 'id')!));
  const included = new Map<string, Element>();
  const omitted: string[] = [];
  for (const el of classElements) {
    const id = xmiAttr(el, 'id')!;
    if (diagramHasClasses && !geometryBySubject.has(id)) {
      omitted.push(el.getAttribute('name') ?? id);
      continue;
    }
    included.set(id, el);
  }
  if (omitted.length) {
    warnings.push(`Se omitieron ${omitted.length} clase(s) que no estan en el diagrama: ${omitted.join(', ')}`);
  }

  // --- Relaciones: UML estandar ------------------------------------------------
  const rawRelationships = new Map<string, RawRelationship>();

  const endTypeId = (end: Element | undefined) =>
    xmiAttr(firstChild(end, 'type'), 'idref') ?? end?.getAttribute('type') ?? null;

  const endMultiplicity = (end: Element | undefined) =>
    toMultiplicity(firstChild(end, 'lowerValue')?.getAttribute('value'), firstChild(end, 'upperValue')?.getAttribute('value'));

  // Clase asociacion al estilo EA: sus extremos apuntan a ProxyConnectors cuyo
  // `classifier` es el id de la asociacion real a la que "cuelga".
  const associationClassByConnector = new Map<string, string>();

  for (const [classId, el] of included) {
    for (const generalization of childrenNamed(el, 'generalization')) {
      const parentId = generalization.getAttribute('general') ?? xmiAttr(firstChild(generalization, 'general'), 'idref');
      const relId = xmiAttr(generalization, 'id') ?? `gen-${classId}-${parentId}`;
      if (parentId && included.has(parentId)) {
        rawRelationships.set(relId, {
          sourceId: classId,
          targetId: parentId,
          kind: 'GENERALIZATION',
          sourceMultiplicity: '1',
          targetMultiplicity: '1',
        });
      }
    }
  }

  const associationElements = [...descendantsNamed(doc, 'packagedElement'), ...descendantsNamed(doc, 'ownedMember')].filter(
    (el) => ['uml:Association', 'uml:AssociationClass'].includes(xmiAttr(el, 'type') ?? ''),
  );

  for (const assoc of associationElements) {
    const assocId = xmiAttr(assoc, 'id');
    if (!assocId) continue;

    const memberEndIds = [
      ...childrenNamed(assoc, 'memberEnd').map((m) => xmiAttr(m, 'idref')),
      ...(assoc.getAttribute('memberEnd')?.split(/\s+/) ?? []),
    ].filter((id): id is string => Boolean(id));
    let ends = memberEndIds.map((id) => byId.get(id)).filter((e): e is Element => Boolean(e));
    if (ends.length !== 2) ends = childrenNamed(assoc, 'ownedEnd');
    if (ends.length !== 2) continue;

    const typeIds = ends.map(endTypeId);
    if (xmiAttr(assoc, 'type') === 'uml:AssociationClass' && typeIds.some(isProxyConnector)) {
      const proxyClassifier = extElements.get(typeIds.find(isProxyConnector)!)?.getAttribute('classifier');
      if (proxyClassifier) associationClassByConnector.set(proxyClassifier, assocId);
      continue;
    }
    if (!typeIds.every((id) => id && included.has(id))) continue;

    // En UML, `aggregation` va en el extremo tipado por la PARTE; el todo es
    // la clase del otro extremo. Convencion interna: source = parte, target = todo.
    const aggregatedIndex = ends.findIndex((e) => ['shared', 'composite'].includes(e.getAttribute('aggregation') ?? ''));
    let sourceIndex: number;
    let kind: RelationshipKind = 'ASSOCIATION';
    if (aggregatedIndex >= 0) {
      sourceIndex = aggregatedIndex;
      kind = ends[aggregatedIndex].getAttribute('aggregation') === 'composite' ? 'COMPOSITION' : 'AGGREGATION';
    } else {
      const srcIndex = ends.findIndex((e) => /(^|_)src/i.test(xmiAttr(e, 'id') ?? ''));
      sourceIndex = srcIndex >= 0 ? srcIndex : 0;
    }
    const targetIndex = sourceIndex === 0 ? 1 : 0;

    // AssociationClass estandar: el mismo elemento es clase y asociacion (su
    // `name` es el de la clase, no un rol de la relacion).
    const isAssociationClass = xmiAttr(assoc, 'type') === 'uml:AssociationClass';
    rawRelationships.set(assocId, {
      sourceId: typeIds[sourceIndex]!,
      targetId: typeIds[targetIndex]!,
      kind,
      sourceMultiplicity: endMultiplicity(ends[sourceIndex]),
      targetMultiplicity: endMultiplicity(ends[targetIndex]),
      name: isAssociationClass ? undefined : (assoc.getAttribute('name') ?? undefined),
      associationClassId: isAssociationClass ? assocId : undefined,
    });
  }

  // --- Relaciones: conectores de EA (orientacion y multiplicidades exactas) --
  for (const connector of extConnectors) {
    const connectorId = xmiAttr(connector, 'idref');
    if (!connectorId) continue;
    const properties = firstChild(connector, 'properties');
    const eaType = properties?.getAttribute('ea_type');
    const sourceEl = firstChild(connector, 'source');
    const targetEl = firstChild(connector, 'target');
    const sourceId = xmiAttr(sourceEl, 'idref');
    const targetId = xmiAttr(targetEl, 'idref');

    // Conector de clase asociacion (entre ProxyConnectors).
    const associationClass = firstChild(connector, 'extendedProperties')?.getAttribute('associationclass');
    if (associationClass && (isProxyConnector(sourceId) || isProxyConnector(targetId))) {
      const realConnector = extElements.get(sourceId ?? '')?.getAttribute('classifier');
      if (realConnector) associationClassByConnector.set(realConnector, associationClass);
      continue;
    }

    if (!sourceId || !targetId || !included.has(sourceId) || !included.has(targetId)) continue;
    if (!['Association', 'Aggregation', 'Generalization'].includes(eaType ?? '')) continue;

    const sourceType = firstChild(sourceEl, 'type');
    const targetType = firstChild(targetEl, 'type');
    const existing = rawRelationships.get(connectorId);

    if (eaType === 'Generalization') {
      rawRelationships.set(connectorId, {
        sourceId,
        targetId,
        kind: 'GENERALIZATION',
        sourceMultiplicity: '1',
        targetMultiplicity: '1',
      });
      continue;
    }

    let kind: RelationshipKind = 'ASSOCIATION';
    let swap = false;
    const sourceAggregation = sourceType?.getAttribute('aggregation') ?? 'none';
    const targetAggregation = targetType?.getAttribute('aggregation') ?? 'none';
    if (targetAggregation !== 'none' || sourceAggregation !== 'none') {
      // En el conector de EA el rombo (el TODO) esta en el extremo marcado.
      const aggregation = targetAggregation !== 'none' ? targetAggregation : sourceAggregation;
      swap = targetAggregation === 'none';
      kind = aggregation === 'composite' ? 'COMPOSITION' : 'AGGREGATION';
    } else if (eaType === 'Aggregation') {
      kind = properties?.getAttribute('subtype') === 'Strong' ? 'COMPOSITION' : 'AGGREGATION';
    }

    const sourceMultiplicity = parseMultiplicityString(sourceType?.getAttribute('multiplicity'));
    const targetMultiplicity = parseMultiplicityString(targetType?.getAttribute('multiplicity'));
    const label = firstChild(connector, 'labels')?.getAttribute('mt');

    rawRelationships.set(connectorId, {
      sourceId: swap ? targetId : sourceId,
      targetId: swap ? sourceId : targetId,
      kind,
      sourceMultiplicity: (swap ? targetMultiplicity : sourceMultiplicity) ?? (swap ? existing?.targetMultiplicity : existing?.sourceMultiplicity) ?? null,
      targetMultiplicity: (swap ? sourceMultiplicity : targetMultiplicity) ?? (swap ? existing?.sourceMultiplicity : existing?.targetMultiplicity) ?? null,
      name: existing?.name ?? label ?? undefined,
      associationClassId: existing?.associationClassId,
    });
  }

  for (const [connectorId, associationClassId] of associationClassByConnector) {
    const rel = rawRelationships.get(connectorId);
    if (rel && included.has(associationClassId)) rel.associationClassId = associationClassId;
  }

  // --- Atributos, claves primarias y posiciones --------------------------------
  const parentOf = new Map<string, string>();
  for (const rel of rawRelationships.values()) {
    if (rel.kind === 'GENERALIZATION' && !parentOf.has(rel.sourceId)) parentOf.set(rel.sourceId, rel.targetId);
  }

  const newIds = new Map<string, string>();
  const remap = (namespace: string, oldId: string) => {
    const key = `${namespace}:${oldId}`;
    if (!newIds.has(key)) newIds.set(key, crypto.randomUUID());
    return newIds.get(key)!;
  };

  const resolveTypeName = (attrEl: Element, extAttr: Element | undefined): string | null => {
    const typeEl = firstChild(attrEl, 'type');
    const idref = xmiAttr(typeEl, 'idref') ?? attrEl.getAttribute('type');
    if (idref) {
      const typeName = byId.get(idref)?.getAttribute('name');
      if (typeName) return typeName;
      return idref.replace(/^EA[A-Za-z]*_/, '');
    }
    const href = typeEl?.getAttribute('href');
    if (href?.includes('#')) return href.split('#').pop()!;
    return typeEl?.getAttribute('name') ?? firstChild(extAttr, 'properties')?.getAttribute('type') ?? null;
  };

  let gridIndex = 0;
  const classes: UmlClass[] = [];
  const skippedAttributes: string[] = [];

  for (const [oldId, el] of included) {
    const className = el.getAttribute('name')?.trim() || 'Clase';
    const extAttributes = new Map(
      childrenNamed(firstChild(extElements.get(oldId), 'attributes'), 'attribute').map((a) => [xmiAttr(a, 'idref') ?? '', a]),
    );

    const attributeEls = childrenNamed(el, 'ownedAttribute').filter((a) => {
      if (a.getAttribute('association')) return false; // extremo de una asociacion, no un atributo
      const typeId = xmiAttr(firstChild(a, 'type'), 'idref') ?? a.getAttribute('type');
      if (typeId && classElements.some((c) => xmiAttr(c, 'id') === typeId)) {
        skippedAttributes.push(`${className}.${a.getAttribute('name') ?? '?'}`);
        return false;
      }
      return Boolean(a.getAttribute('name')?.trim());
    });

    const attributes: (UmlAttribute & { explicitPk: boolean })[] = attributeEls.map((attrEl) => {
      const attrOldId = xmiAttr(attrEl, 'id') ?? crypto.randomUUID();
      const extAttr = extAttributes.get(attrOldId);
      const lower = firstChild(attrEl, 'lowerValue')?.getAttribute('value') ?? firstChild(extAttr, 'bounds')?.getAttribute('lower');
      const stereotype = firstChild(extAttr, 'stereotype')?.getAttribute('stereotype') ?? '';
      const explicitPk = attrEl.getAttribute('isID') === 'true' || /^(pk|id|primarykey)$/i.test(stereotype);
      const defaultValue =
        firstChild(attrEl, 'defaultValue')?.getAttribute('value') ?? firstChild(extAttr, 'initial')?.getAttribute('body') ?? undefined;
      return {
        id: remap('attr', attrOldId),
        name: attrEl.getAttribute('name')!.trim(),
        type: mapDataType(resolveTypeName(attrEl, extAttr)),
        isPrimaryKey: explicitPk,
        explicitPk,
        // En UML, sin lowerValue la multiplicidad por defecto es 1 (obligatorio).
        nullable: lower === '0',
        defaultValue: defaultValue || undefined,
      };
    });

    // Clave primaria: la marcada explicitamente; si no hay, "id", "idClase"
    // o "claseId" (tambien con el nombre de un ancestro, ej. "idPersona" en
    // Docente), o el primer atributo que empiece con "id".
    if (!attributes.some((a) => a.explicitPk)) {
      const ownerNames = [className];
      for (let current = parentOf.get(oldId); current; current = parentOf.get(current)) {
        ownerNames.push(included.get(current)?.getAttribute('name') ?? '');
        if (ownerNames.length > 10) break;
      }
      const candidates = new Set(['id', ...ownerNames.flatMap((n) => [`id${normalizeName(n)}`, `${normalizeName(n)}id`])]);
      const pk =
        attributes.find((a) => candidates.has(normalizeName(a.name))) ?? attributes.find((a) => /^id([A-Z_]|$)/.test(a.name));
      if (pk) {
        pk.isPrimaryKey = true;
        pk.nullable = false;
      }
    }

    const geometry = geometryBySubject.get(oldId);
    const left = Number(geometry?.match(/Left=(-?\d+)/)?.[1]);
    const top = Number(geometry?.match(/Top=(-?\d+)/)?.[1]);
    const position =
      Number.isFinite(left) && Number.isFinite(top)
        ? { x: left * EA_COORDINATE_SCALE, y: top * EA_COORDINATE_SCALE }
        : { x: 80 + (gridIndex % 4) * 280, y: 80 + Math.floor(gridIndex++ / 4) * 260 };

    classes.push({
      id: remap('class', oldId),
      name: className,
      position,
      attributes: attributes.map(({ explicitPk: _explicitPk, ...attr }) => attr),
    });
  }

  if (skippedAttributes.length) {
    warnings.push(`Se omitieron atributos cuyo tipo es otra clase (usa una relacion): ${skippedAttributes.join(', ')}`);
  }

  const relationships: UmlRelationship[] = [];
  for (const [oldId, raw] of rawRelationships) {
    const defaults = DEFAULT_MULTIPLICITIES[raw.kind];
    const associationClassId =
      raw.kind === 'ASSOCIATION' && raw.associationClassId && raw.associationClassId !== raw.sourceId && raw.associationClassId !== raw.targetId
        ? remap('class', raw.associationClassId)
        : undefined;
    relationships.push({
      id: remap('rel', oldId),
      sourceClassId: remap('class', raw.sourceId),
      targetClassId: remap('class', raw.targetId),
      kind: raw.kind,
      sourceMultiplicity: raw.kind === 'GENERALIZATION' ? '1' : (raw.sourceMultiplicity ?? defaults.source),
      targetMultiplicity: raw.kind === 'GENERALIZATION' ? '1' : (raw.targetMultiplicity ?? defaults.target),
      name: raw.name?.trim() || undefined,
      associationClassId,
    });
  }

  const namesSeen = new Map<string, number>();
  for (const klass of classes) namesSeen.set(klass.name, (namesSeen.get(klass.name) ?? 0) + 1);
  const duplicated = [...namesSeen].filter(([, count]) => count > 1).map(([name]) => name);
  if (duplicated.length) warnings.push(`Hay clases con el mismo nombre: ${duplicated.join(', ')}`);

  return { classes, relationships, warnings };
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------

// Formato de GUID de EA: {F6F2CD63-6E8D-45b5-A5B9-901F2C21CFA3} se escribe
// en XMI como EAID_F6F2CD63_6E8D_45b5_A5B9_901F2C21CFA3.
function eaGuid(uuid: string): string {
  return uuid.replace(/-/g, '_').toUpperCase();
}

function eaId(uuid: string): string {
  return `EAID_${eaGuid(uuid)}`;
}

// Extremos de una asociacion: EA reemplaza los 3 primeros caracteres del GUID
// por "src"/"dst".
function eaEndId(relationshipUuid: string, end: 'src' | 'dst'): string {
  return `EAID_${end}${eaGuid(relationshipUuid).slice(3)}`;
}

function primitiveTypeId(type: UmlDataType): string {
  return `EAnone_${type}`;
}

function estimateEaSize(klass: UmlClass): { width: number; height: number } {
  const longest = Math.max(
    klass.name.length + 2,
    ...klass.attributes.map((a) => `- ${a.name}: ${a.type}`.length),
  );
  return { width: Math.max(90, Math.round(longest * 5.4 + 22)), height: Math.max(70, 40 + klass.attributes.length * 13) };
}

export function exportToXmi(classes: UmlClass[], relationships: UmlRelationship[], modelName: string): string {
  const packageGuid = eaGuid(crypto.randomUUID());
  const packageId = `EAPK_${packageGuid}`;
  const diagramId = `EAID_${eaGuid(crypto.randomUUID())}`;
  const classById = new Map(classes.map((c) => [c.id, c]));
  const associationClassIds = new Set(relationships.map((r) => r.associationClassId).filter(Boolean));
  let literalCounter = 0;
  const literalId = (ownerUuid: string) => `EAID_LI${String(++literalCounter).padStart(6, '0')}_${eaGuid(ownerUuid).slice(9)}`;

  const bounds = (m: Multiplicity, ownerUuid: string, indent: string) => {
    const { lower, upper } = multiplicityBounds(m);
    const upperType = upper === '*' ? 'uml:LiteralUnlimitedNatural' : 'uml:LiteralInteger';
    return [
      `${indent}<lowerValue xmi:type="uml:LiteralInteger" xmi:id="${literalId(ownerUuid)}" value="${lower}"/>`,
      `${indent}<upperValue xmi:type="${upperType}" xmi:id="${literalId(ownerUuid)}" value="${upper === '*' ? '-1' : upper}"/>`,
    ];
  };

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<xmi:XMI xmi:version="2.1" xmlns:uml="${UML_NS}" xmlns:xmi="${XMI_NS}">`,
    '\t<xmi:Documentation exporter="Enterprise Architect" exporterVersion="6.5"/>',
    '\t<uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">',
    `\t\t<packagedElement xmi:type="uml:Package" xmi:id="${packageId}" name="${escapeXml(modelName)}" visibility="public">`,
  ];

  // Clase asociacion en UML estandar: la misma pieza es clase y asociacion.
  const associationForClass = new Map<string, UmlRelationship>();
  for (const rel of relationships) {
    if (rel.kind === 'ASSOCIATION' && rel.associationClassId) associationForClass.set(rel.associationClassId, rel);
  }

  const writeEnds = (rel: UmlRelationship, ownerXmiId: string, indent: string) => {
    const srcEnd = eaEndId(rel.id, 'src');
    const dstEnd = eaEndId(rel.id, 'dst');
    // Todo-parte: `aggregation` va en el extremo de la PARTE (source).
    const aggregation = rel.kind === 'COMPOSITION' ? 'composite' : rel.kind === 'AGGREGATION' ? 'shared' : 'none';
    const endAttributes = `visibility="public" association="${ownerXmiId}" isStatic="false" isReadOnly="false" isDerived="false" isOrdered="false" isUnique="true" isDerivedUnion="false"`;
    lines.push(
      `${indent}<memberEnd xmi:idref="${dstEnd}"/>`,
      `${indent}<memberEnd xmi:idref="${srcEnd}"/>`,
      `${indent}<ownedEnd xmi:type="uml:Property" xmi:id="${srcEnd}" ${endAttributes} aggregation="${aggregation}">`,
      `${indent}\t<type xmi:idref="${eaId(rel.sourceClassId)}"/>`,
      ...bounds(rel.sourceMultiplicity, rel.id, `${indent}\t`),
      `${indent}</ownedEnd>`,
      `${indent}<ownedEnd xmi:type="uml:Property" xmi:id="${dstEnd}" ${endAttributes} aggregation="none">`,
      `${indent}\t<type xmi:idref="${eaId(rel.targetClassId)}"/>`,
      ...bounds(rel.targetMultiplicity, rel.id, `${indent}\t`),
      `${indent}</ownedEnd>`,
    );
  };

  for (const klass of classes) {
    const association = associationForClass.get(klass.id);
    const xmiType = association ? 'uml:AssociationClass' : 'uml:Class';
    lines.push(`\t\t\t<packagedElement xmi:type="${xmiType}" xmi:id="${eaId(klass.id)}" name="${escapeXml(klass.name)}" visibility="public">`);
    for (const attr of klass.attributes) {
      lines.push(
        `\t\t\t\t<ownedAttribute xmi:type="uml:Property" xmi:id="${eaId(attr.id)}" name="${escapeXml(attr.name)}" visibility="private" isStatic="false" isReadOnly="false" isDerived="false" isOrdered="false" isUnique="true" isDerivedUnion="false"${attr.isPrimaryKey ? ' isID="true"' : ''}>`,
        ...bounds(attr.nullable && !attr.isPrimaryKey ? '0..1' : '1', attr.id, '\t\t\t\t\t'),
        `\t\t\t\t\t<type xmi:idref="${primitiveTypeId(attr.type)}"/>`,
      );
      if (attr.defaultValue !== undefined && attr.defaultValue !== '') {
        lines.push(`\t\t\t\t\t<defaultValue xmi:type="uml:LiteralString" xmi:id="${literalId(attr.id)}" value="${escapeXml(attr.defaultValue)}"/>`);
      }
      lines.push('\t\t\t\t</ownedAttribute>');
    }
    for (const rel of relationships) {
      if (rel.kind === 'GENERALIZATION' && rel.sourceClassId === klass.id) {
        lines.push(`\t\t\t\t<generalization xmi:type="uml:Generalization" xmi:id="${eaId(rel.id)}" general="${eaId(rel.targetClassId)}"/>`);
      }
    }
    if (association) writeEnds(association, eaId(klass.id), '\t\t\t\t');
    lines.push('\t\t\t</packagedElement>');
  }

  for (const rel of relationships) {
    if (rel.kind === 'GENERALIZATION' || rel.associationClassId) continue;
    const name = rel.name ? ` name="${escapeXml(rel.name)}"` : '';
    lines.push(`\t\t\t<packagedElement xmi:type="uml:Association" xmi:id="${eaId(rel.id)}"${name} visibility="public">`);
    writeEnds(rel, eaId(rel.id), '\t\t\t\t');
    lines.push('\t\t\t</packagedElement>');
  }

  lines.push('\t\t</packagedElement>', '\t</uml:Model>');

  // --- Extension de Enterprise Architect ---------------------------------------
  let localId = 1;
  lines.push(
    '\t<xmi:Extension extender="Enterprise Architect" extenderID="6.5">',
    '\t\t<elements>',
    `\t\t\t<element xmi:idref="${packageId}" xmi:type="uml:Package" name="${escapeXml(modelName)}" scope="public">`,
    `\t\t\t\t<model package2="EAID_${packageGuid}" package="EAPK_${packageGuid}" tpos="0" ea_localid="${localId++}" ea_eleType="package"/>`,
    '\t\t\t\t<properties isSpecification="false" sType="Package" nType="0" scope="public"/>',
    '\t\t\t</element>',
  );

  for (const klass of classes) {
    lines.push(
      `\t\t\t<element xmi:idref="${eaId(klass.id)}" xmi:type="uml:Class" name="${escapeXml(klass.name)}" scope="public">`,
      `\t\t\t\t<model package="${packageId}" tpos="0" ea_localid="${localId++}" ea_eleType="element"/>`,
      `\t\t\t\t<properties isSpecification="false" sType="Class" nType="${associationClassIds.has(klass.id) ? 17 : 0}" scope="public" isRoot="false" isLeaf="false" isAbstract="false" isActive="false"/>`,
      '\t\t\t\t<code gentype="Java"/>',
      '\t\t\t\t<attributes>',
    );
    klass.attributes.forEach((attr, index) => {
      const { lower, upper } = multiplicityBounds(attr.nullable && !attr.isPrimaryKey ? '0..1' : '1');
      lines.push(
        `\t\t\t\t\t<attribute xmi:idref="${eaId(attr.id)}" name="${escapeXml(attr.name)}" scope="Private">`,
        attr.defaultValue ? `\t\t\t\t\t\t<initial body="${escapeXml(attr.defaultValue)}"/>` : '\t\t\t\t\t\t<initial/>',
        `\t\t\t\t\t\t<model ea_localid="${localId++}" ea_guid="{${attr.id.toUpperCase()}}"/>`,
        `\t\t\t\t\t\t<properties type="${attr.type}" collection="false" static="0" duplicates="0" changeability="changeable"/>`,
        `\t\t\t\t\t\t<containment containment="Not Specified" position="${index}"/>`,
        attr.isPrimaryKey ? '\t\t\t\t\t\t<stereotype stereotype="PK"/>' : '\t\t\t\t\t\t<stereotype/>',
        `\t\t\t\t\t\t<bounds lower="${lower}" upper="${upper}"/>`,
        '\t\t\t\t\t</attribute>',
      );
    });
    lines.push('\t\t\t\t</attributes>', '\t\t\t</element>');
  }
  lines.push('\t\t</elements>', '\t\t<connectors>');

  for (const rel of relationships) {
    // La clase asociacion va como uml:AssociationClass estandar (arriba).
    if (rel.associationClassId) continue;
    const source = classById.get(rel.sourceClassId);
    const target = classById.get(rel.targetClassId);
    if (!source || !target) continue;
    const isGeneralization = rel.kind === 'GENERALIZATION';
    const eaType = isGeneralization ? 'Generalization' : rel.kind === 'ASSOCIATION' ? 'Association' : 'Aggregation';
    const subtype = rel.kind === 'COMPOSITION' ? ' subtype="Strong"' : rel.kind === 'AGGREGATION' ? ' subtype="Weak"' : '';
    const direction = rel.kind === 'ASSOCIATION' ? 'Unspecified' : 'Source -&gt; Destination';
    const targetAggregation = rel.kind === 'COMPOSITION' ? 'composite' : rel.kind === 'AGGREGATION' ? 'shared' : 'none';
    const multiplicity = (m: Multiplicity) => (isGeneralization ? '' : ` multiplicity="${m}"`);

    lines.push(
      `\t\t\t<connector xmi:idref="${eaId(rel.id)}">`,
      `\t\t\t\t<source xmi:idref="${eaId(source.id)}">`,
      `\t\t\t\t\t<model type="Class" name="${escapeXml(source.name)}"/>`,
      '\t\t\t\t\t<role visibility="Public" targetScope="instance"/>',
      `\t\t\t\t\t<type${multiplicity(rel.sourceMultiplicity)} aggregation="none" containment="Unspecified"/>`,
      '\t\t\t\t\t<modifiers isOrdered="false" changeable="none" isNavigable="false"/>',
      '\t\t\t\t</source>',
      `\t\t\t\t<target xmi:idref="${eaId(target.id)}">`,
      `\t\t\t\t\t<model type="Class" name="${escapeXml(target.name)}"/>`,
      '\t\t\t\t\t<role visibility="Public" targetScope="instance"/>',
      `\t\t\t\t\t<type${multiplicity(rel.targetMultiplicity)} aggregation="${targetAggregation}" containment="Unspecified"/>`,
      `\t\t\t\t\t<modifiers isOrdered="false" changeable="none" isNavigable="${isGeneralization || rel.kind !== 'ASSOCIATION'}"/>`,
      '\t\t\t\t</target>',
      `\t\t\t\t<model ea_localid="${localId++}"/>`,
      `\t\t\t\t<properties ea_type="${eaType}"${subtype} direction="${direction}"/>`,
      '\t\t\t\t<modifiers isRoot="false" isLeaf="false"/>',
      '\t\t\t\t<appearance linemode="3" linecolor="-1" linewidth="0" seqno="0" headStyle="0" lineStyle="0"/>',
      isGeneralization
        ? '\t\t\t\t<labels/>'
        : `\t\t\t\t<labels lb="${rel.sourceMultiplicity}" rb="${rel.targetMultiplicity}"${rel.name ? ` mt="${escapeXml(rel.name)}"` : ''}/>`,
      '\t\t\t\t<extendedProperties virtualInheritance="0"/>',
      '\t\t\t</connector>',
    );
  }
  lines.push('\t\t</connectors>');

  const usedTypes = Array.from(new Set(classes.flatMap((c) => c.attributes.map((a) => a.type))));
  lines.push(
    '\t\t<primitivetypes>',
    '\t\t\t<packagedElement xmi:type="uml:Package" xmi:id="EAPrimitiveTypesPackage" name="EA_PrimitiveTypes_Package" visibility="public">',
    '\t\t\t\t<packagedElement xmi:type="uml:Package" xmi:id="EAnoneTypesPackage" name="EA_none_Types_Package" visibility="public">',
    ...usedTypes.map(
      (type) => `\t\t\t\t\t<packagedElement xmi:type="uml:PrimitiveType" xmi:id="${primitiveTypeId(type)}" name="${type}" visibility="public"/>`,
    ),
    '\t\t\t\t</packagedElement>',
    '\t\t\t</packagedElement>',
    '\t\t</primitivetypes>',
  );

  // Diagrama: una sola vista con todas las clases en su posicion y los conectores.
  const duidFor = new Map(classes.map((c) => [c.id, eaGuid(c.id).slice(0, 8)]));
  lines.push(
    '\t\t<diagrams>',
    `\t\t\t<diagram xmi:id="${diagramId}">`,
    `\t\t\t\t<model package="${packageId}" localID="1" owner="${packageId}"/>`,
    `\t\t\t\t<properties name="${escapeXml(modelName)}" type="Logical"/>`,
    '\t\t\t\t<style1 value="ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=0;PPgs.cy=0;DocSize.cx=850;DocSize.cy=1098;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=1;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AllDockable=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;SPT=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;"/>',
    '\t\t\t\t<elements>',
  );
  classes.forEach((klass, index) => {
    const { width, height } = estimateEaSize(klass);
    const left = Math.round(klass.position.x / EA_COORDINATE_SCALE);
    const top = Math.round(klass.position.y / EA_COORDINATE_SCALE);
    lines.push(
      `\t\t\t\t\t<element geometry="Left=${left};Top=${top};Right=${left + width};Bottom=${top + height};" subject="${eaId(klass.id)}" seqno="${index + 1}" style="DUID=${duidFor.get(klass.id)};"/>`,
    );
  });
  for (const rel of relationships) {
    if (rel.associationClassId) continue;
    lines.push(
      `\t\t\t\t\t<element geometry="SX=0;SY=0;EX=0;EY=0;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;" subject="${eaId(rel.id)}" style="Mode=3;EOID=${duidFor.get(rel.targetClassId)};SOID=${duidFor.get(rel.sourceClassId)};Color=-1;LWidth=0;Hidden=0;"/>`,
    );
  }
  lines.push('\t\t\t\t</elements>', '\t\t\t</diagram>', '\t\t</diagrams>', '\t</xmi:Extension>', '</xmi:XMI>');

  return lines.join('\n');
}
