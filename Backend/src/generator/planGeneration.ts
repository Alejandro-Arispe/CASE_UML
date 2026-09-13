import { isManyMultiplicity, isOptionalMultiplicity, UmlAttribute, UmlModel, UmlRelationship } from '../domain/entities';
import { ValidationIssue } from '../domain/validation/ValidationIssue';
import {
  allAttributes,
  allManyRefs,
  allSingleRefs,
  GenAttribute,
  GenClass,
  GenComposedCollection,
  GenerationModel,
  GenManyRef,
  GenSingleRef,
} from './GenerationModel';
import {
  JAVA_KEYWORDS,
  RESERVED_CLASS_NAMES,
  shortProjectId,
  toCamelCase,
  toPascalCase,
  toPluralCamelCase,
  toPluralSlug,
  toSnakeCase,
} from './naming';
import { JAVA_IMPORT, JAVA_TYPE, SQL_TYPE } from './typeMapping';

export interface GenerationPlan {
  model: GenerationModel;
  // Problemas que dependen de COMO se genera (PK, choques de campos y
  // columnas, palabras reservadas). Se muestran en "Validar modelo" junto
  // con los estructurales, y los de severidad ERROR bloquean la generacion.
  issues: ValidationIssue[];
}

// Traduce el UML (ya validado estructuralmente) al modelo intermedio del
// generador. Reglas de mapeo a JPA:
// - Herencia: estrategia JOINED (una tabla por clase, la subclase comparte
//   la PK de la raiz). La PK declarada en una subclase se ignora.
// - Asociacion/agregacion/composicion segun multiplicidades:
//     1 -- 0..*   => la clase del lado "muchos" tiene @ManyToOne (FK).
//     1 -- 1      => @OneToOne con FK UNIQUE (en la parte, o en el lado opcional).
//     *  -- *     => @ManyToMany con tabla intermedia.
// - Composicion: ademas, el todo recibe @OneToMany(cascade = ALL,
//   orphanRemoval = true): borrar el todo borra sus partes.
// - Clase asociacion: la clase recibe dos @ManyToOne obligatorios hacia
//   los extremos (reemplaza la tabla intermedia, y puede tener atributos).
export function planGeneration(model: UmlModel, projectId: string): GenerationPlan {
  const issues: ValidationIssue[] = [];
  const reported = new Set<string>();
  const report = (issue: ValidationIssue) => {
    const key = `${issue.code}:${issue.elementId}`;
    if (reported.has(key)) return;
    reported.add(key);
    issues.push(issue);
  };

  const shortId = shortProjectId(projectId);
  const umlClassById = new Map(model.classes.map((c) => [c.id, c]));

  // --- Herencia ------------------------------------------------------------
  const parentOf = new Map<string, string>();
  for (const rel of model.relationships) {
    if (rel.kind !== 'GENERALIZATION') continue;
    if (!umlClassById.has(rel.sourceClassId) || !umlClassById.has(rel.targetClassId)) continue;
    if (!parentOf.has(rel.sourceClassId)) parentOf.set(rel.sourceClassId, rel.targetClassId);
  }
  const classesWithChildren = new Set(parentOf.values());

  // Ancestros desde el padre directo hasta la raiz (con guarda anti-ciclos:
  // el validador estructural ya reporta ciclos, aca solo no hay que colgarse).
  function ancestorsOf(classId: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>([classId]);
    let current = parentOf.get(classId);
    while (current && !seen.has(current)) {
      result.push(current);
      seen.add(current);
      current = parentOf.get(current);
    }
    return result;
  }

  // --- Clases y atributos ---------------------------------------------------
  const genById = new Map<string, GenClass>();
  const attributeOrigin = new Map<GenAttribute, UmlAttribute>();

  const placeholderPk: GenAttribute = {
    fieldName: 'id',
    columnName: 'id',
    javaType: 'Long',
    sqlType: 'BIGINT',
    nullable: false,
    isPrimaryKey: true,
  };

  for (const klass of model.classes) {
    const className = toPascalCase(klass.name);
    if (RESERVED_CLASS_NAMES.has(className)) {
      report({
        code: 'RESERVED_JAVA_NAME',
        severity: 'ERROR',
        elementType: 'CLASS',
        elementId: klass.id,
        message: `La clase "${klass.name}" genera el identificador Java "${className}", que choca con un tipo usado por el backend generado. Renombrala (ej. "${className}Entidad").`,
      });
    }

    const attributes = klass.attributes.map((attr) => {
      const gen: GenAttribute = {
        fieldName: toCamelCase(attr.name),
        columnName: toSnakeCase(attr.name),
        javaType: JAVA_TYPE[attr.type],
        sqlType: SQL_TYPE[attr.type],
        javaImport: JAVA_IMPORT[attr.type],
        nullable: attr.isPrimaryKey ? false : attr.nullable,
        isPrimaryKey: attr.isPrimaryKey,
        defaultValue: attr.defaultValue,
      };
      attributeOrigin.set(gen, attr);
      if (JAVA_KEYWORDS.has(gen.fieldName)) {
        report({
          code: 'RESERVED_JAVA_NAME',
          severity: 'ERROR',
          elementType: 'ATTRIBUTE',
          elementId: attr.id,
          message: `El atributo "${attr.name}" de "${klass.name}" es una palabra reservada de Java. Renombralo (ej. "${gen.fieldName}Valor").`,
        });
      }
      return gen;
    });

    const pks = attributes.filter((a) => a.isPrimaryKey);
    const isSubclass = parentOf.has(klass.id);

    if (isSubclass) {
      for (const pk of pks) {
        const parentName = umlClassById.get(parentOf.get(klass.id)!)?.name;
        report({
          code: 'SUBCLASS_PRIMARY_KEY_IGNORED',
          severity: 'WARNING',
          elementType: 'ATTRIBUTE',
          elementId: attributeOrigin.get(pk)!.id,
          message: `"${klass.name}" hereda la clave primaria de "${parentName}": el atributo "${attributeOrigin.get(pk)!.name}" no se genera (en la base, la PK de la subclase es la misma que la del padre).`,
        });
      }
    } else if (pks.length === 0) {
      report({
        code: 'ENTITY_WITHOUT_PRIMARY_KEY',
        severity: 'ERROR',
        elementType: 'CLASS',
        elementId: klass.id,
        message: `La clase "${klass.name}" no tiene clave primaria`,
      });
    } else if (pks.length > 1) {
      report({
        code: 'COMPOSITE_PRIMARY_KEY',
        severity: 'ERROR',
        elementType: 'CLASS',
        elementId: klass.id,
        message: `La clase "${klass.name}" tiene ${pks.length} atributos marcados como PK; el generador admite una sola clave primaria por clase`,
      });
    }

    genById.set(klass.id, {
      umlClassId: klass.id,
      className,
      tableName: toSnakeCase(klass.name),
      pluralSlug: toPluralSlug(klass.name),
      isInheritanceRoot: classesWithChildren.has(klass.id) && !isSubclass,
      pkAttribute: pks[0] ?? placeholderPk,
      attributes: attributes.filter((a) => !a.isPrimaryKey),
      singleRefs: [],
      manyRefs: [],
      composedCollections: [],
      inheritedAttributes: [],
      inheritedSingleRefs: [],
      inheritedManyRefs: [],
    });
  }

  // Las subclases usan la PK de la raiz de su jerarquia.
  for (const [childId, parentId] of parentOf) {
    const child = genById.get(childId)!;
    const ancestors = ancestorsOf(childId);
    const root = genById.get(ancestors[ancestors.length - 1] ?? parentId)!;
    child.parentClassName = genById.get(parentId)!.className;
    child.pkAttribute = root.pkAttribute;
  }

  // --- Relaciones -----------------------------------------------------------
  const refOrigin = new Map<GenSingleRef | GenManyRef | GenComposedCollection, UmlRelationship>();

  function addSingleRef(
    rel: UmlRelationship,
    owner: GenClass,
    referenced: GenClass,
    annotation: GenSingleRef['annotation'],
    optional: boolean,
    fieldName: string,
  ): GenSingleRef {
    const ref: GenSingleRef = {
      fieldName,
      columnName: `${toSnakeCase(fieldName)}_id`,
      referencedClassName: referenced.className,
      referencedPkJavaType: referenced.pkAttribute.javaType,
      referencedPkJavaImport: referenced.pkAttribute.javaImport,
      referencedPkFieldName: referenced.pkAttribute.fieldName,
      annotation,
      optional,
      unique: annotation === 'OneToOne',
    };
    owner.singleRefs.push(ref);
    refOrigin.set(ref, rel);
    return ref;
  }

  for (const rel of model.relationships) {
    if (rel.kind === 'GENERALIZATION') continue;
    const source = genById.get(rel.sourceClassId);
    const target = genById.get(rel.targetClassId);
    if (!source || !target) continue;

    const isSelf = source === target;
    const roleName = rel.name ? toCamelCase(rel.name) : undefined;
    // Nombre del campo que apunta a `referenced`: el rol si lo hay; si es
    // una autorrelacion sin rol, "relacionX" para no chocar con la propia clase.
    const singleFieldName = (referenced: GenClass) =>
      roleName ?? (isSelf ? `relacion${referenced.className}` : toCamelCase(referenced.className));

    if (rel.associationClassId) {
      const associationClass = genById.get(rel.associationClassId);
      if (!associationClass) continue;
      addSingleRef(rel, associationClass, source, 'ManyToOne', false, toCamelCase(source.className));
      addSingleRef(
        rel,
        associationClass,
        target,
        'ManyToOne',
        false,
        isSelf ? (roleName ?? `relacion${target.className}`) : toCamelCase(target.className),
      );
      continue;
    }

    const sourceMany = isManyMultiplicity(rel.sourceMultiplicity);
    const targetMany = isManyMultiplicity(rel.targetMultiplicity);

    if (!sourceMany && targetMany) {
      // Un source tiene muchos targets: el target guarda la FK al source.
      addSingleRef(rel, target, source, 'ManyToOne', isOptionalMultiplicity(rel.sourceMultiplicity), singleFieldName(source));
    } else if (sourceMany && !targetMany) {
      const ref = addSingleRef(
        rel,
        source,
        target,
        'ManyToOne',
        isOptionalMultiplicity(rel.targetMultiplicity),
        singleFieldName(target),
      );
      // Composicion (target = todo, source = parte): el todo borra sus partes.
      if (rel.kind === 'COMPOSITION' && !isSelf) {
        const collection: GenComposedCollection = {
          fieldName: toPluralCamelCase(source.className),
          partClassName: source.className,
          mappedBy: ref.fieldName,
        };
        target.composedCollections.push(collection);
        refOrigin.set(collection, rel);
      }
    } else if (!sourceMany && !targetMany) {
      // 1:1. En todo-parte la FK va en la parte (source); si no, en el lado
      // opcional ("0..1") que depende del obligatorio; por defecto en target.
      if (rel.kind === 'AGGREGATION' || rel.kind === 'COMPOSITION') {
        addSingleRef(rel, source, target, 'OneToOne', isOptionalMultiplicity(rel.targetMultiplicity), singleFieldName(target));
      } else if (rel.targetMultiplicity === '1' && rel.sourceMultiplicity === '0..1') {
        addSingleRef(rel, source, target, 'OneToOne', false, singleFieldName(target));
      } else {
        addSingleRef(rel, target, source, 'OneToOne', isOptionalMultiplicity(rel.sourceMultiplicity), singleFieldName(source));
      }
    } else {
      // *:* -> tabla intermedia, owning side = source.
      const fieldName = roleName ?? (isSelf ? `relacion${toPascalCase(toPluralCamelCase(target.className))}` : toPluralCamelCase(target.className));
      const manyRef: GenManyRef = {
        fieldName,
        referencedClassName: target.className,
        referencedPkJavaType: target.pkAttribute.javaType,
        referencedPkJavaImport: target.pkAttribute.javaImport,
        referencedPkFieldName: target.pkAttribute.fieldName,
        joinTableName: roleName || isSelf ? `${source.tableName}_${toSnakeCase(fieldName)}` : `${source.tableName}_${target.tableName}`,
        joinColumnName: `${source.tableName}_id`,
        inverseJoinColumnName: isSelf ? `${toSnakeCase(fieldName)}_id` : `${target.tableName}_id`,
      };
      source.manyRefs.push(manyRef);
      refOrigin.set(manyRef, rel);
    }
  }

  // --- Campos heredados (para DTOs y service) -------------------------------
  for (const [childId] of parentOf) {
    const child = genById.get(childId)!;
    const ancestors = ancestorsOf(childId).reverse().map((id) => genById.get(id)!);
    child.inheritedAttributes = ancestors.flatMap((a) => a.attributes);
    child.inheritedSingleRefs = ancestors.flatMap((a) => a.singleRefs);
    child.inheritedManyRefs = ancestors.flatMap((a) => a.manyRefs);
  }

  // --- Choques de nombres ---------------------------------------------------
  for (const klass of model.classes) {
    const gen = genById.get(klass.id)!;
    const isSubclass = parentOf.has(klass.id);
    const inheritedComposed = ancestorsOf(klass.id).flatMap((id) => genById.get(id)!.composedCollections);

    // 1) Campos Java de la entidad (incluye heredados: redefinirlos rompe
    //    getters/setters y duplica campos en el DTO).
    type FieldOwner =
      | { kind: 'pk' }
      | { kind: 'attribute'; attr: GenAttribute; inherited: boolean }
      | { kind: 'ref'; ref: GenSingleRef | GenManyRef | GenComposedCollection; inherited: boolean };
    const fields = new Map<string, FieldOwner>();

    const describe = (owner: FieldOwner): string => {
      if (owner.kind === 'pk') return `la clave primaria "${gen.pkAttribute.fieldName}"`;
      if (owner.kind === 'attribute') return `el atributo "${attributeOrigin.get(owner.attr)?.name ?? owner.attr.fieldName}"`;
      const rel = refOrigin.get(owner.ref)!;
      const other = umlClassById.get(rel.sourceClassId === klass.id ? rel.targetClassId : rel.sourceClassId)?.name;
      return `la relacion con "${other}"`;
    };

    const elementOf = (owner: FieldOwner): Pick<ValidationIssue, 'elementType' | 'elementId'> => {
      if (owner.kind === 'attribute' && attributeOrigin.get(owner.attr)) {
        return { elementType: 'ATTRIBUTE', elementId: attributeOrigin.get(owner.attr)!.id };
      }
      if (owner.kind === 'ref') return { elementType: 'RELATIONSHIP', elementId: refOrigin.get(owner.ref)!.id };
      return { elementType: 'CLASS', elementId: klass.id };
    };

    const claimField = (name: string, owner: FieldOwner) => {
      const existing = fields.get(name);
      if (!existing) {
        fields.set(name, owner);
        return;
      }
      const bothRefs = existing.kind === 'ref' && owner.kind === 'ref';
      const attrVsRef =
        (existing.kind === 'attribute' && owner.kind === 'ref') || (existing.kind === 'ref' && owner.kind === 'attribute');
      const culprit = owner.kind === 'attribute' ? owner : existing.kind === 'attribute' ? existing : owner;
      let message = `"${klass.name}": ${describe(existing)} y ${describe(owner)} generan el mismo campo "${name}".`;
      if (bothRefs) {
        message += ' Ponle un nombre (rol) a una de las relaciones para diferenciarlas, ej. "comprador" y "vendedor".';
      } else if (attrVsRef) {
        message += ' Si ese atributo es la clave foranea, eliminalo: la relacion ya la genera.';
      }
      report({ code: 'FIELD_NAME_COLLISION', severity: 'ERROR', ...elementOf(culprit), message });
    };

    if (!isSubclass) claimField(gen.pkAttribute.fieldName, { kind: 'pk' });
    for (const attr of gen.inheritedAttributes) claimField(attr.fieldName, { kind: 'attribute', attr, inherited: true });
    for (const attr of gen.attributes) claimField(attr.fieldName, { kind: 'attribute', attr, inherited: false });
    for (const ref of gen.inheritedSingleRefs) claimField(ref.fieldName, { kind: 'ref', ref, inherited: true });
    for (const ref of gen.inheritedManyRefs) claimField(ref.fieldName, { kind: 'ref', ref, inherited: true });
    for (const ref of inheritedComposed) claimField(ref.fieldName, { kind: 'ref', ref, inherited: true });
    for (const ref of gen.singleRefs) claimField(ref.fieldName, { kind: 'ref', ref, inherited: false });
    for (const ref of gen.manyRefs) claimField(ref.fieldName, { kind: 'ref', ref, inherited: false });
    for (const ref of gen.composedCollections) claimField(ref.fieldName, { kind: 'ref', ref, inherited: false });

    // 2) Campos de los DTOs: "id" + atributos + "xId" por FK + "xIds" por N:M.
    const dtoFields = new Map<string, FieldOwner>();
    const claimDto = (name: string, owner: FieldOwner) => {
      const existing = dtoFields.get(name);
      if (!existing) {
        dtoFields.set(name, owner);
        return;
      }
      const culprit = owner.kind === 'attribute' ? owner : existing.kind === 'attribute' ? existing : owner;
      report({
        code: 'FIELD_NAME_COLLISION',
        severity: 'ERROR',
        ...elementOf(culprit),
        message: `"${klass.name}": ${describe(existing)} y ${describe(owner)} generan el mismo campo "${name}" en el DTO. Si el atributo es la clave foranea, eliminalo: la relacion ya la genera.`,
      });
    };
    claimDto('id', { kind: 'pk' });
    for (const attr of allAttributes(gen)) claimDto(attr.fieldName, { kind: 'attribute', attr, inherited: false });
    for (const ref of allSingleRefs(gen)) claimDto(`${ref.fieldName}Id`, { kind: 'ref', ref, inherited: false });
    for (const ref of allManyRefs(gen)) claimDto(`${ref.fieldName}Ids`, { kind: 'ref', ref, inherited: false });

    // 3) Columnas de la tabla propia (en JOINED cada clase tiene su tabla).
    const columns = new Map<string, FieldOwner>();
    const claimColumn = (column: string, owner: FieldOwner) => {
      const existing = columns.get(column);
      if (!existing) {
        columns.set(column, owner);
        return;
      }
      const culprit = owner.kind === 'attribute' ? owner : existing.kind === 'attribute' ? existing : owner;
      const isFkDuplicate =
        (existing.kind === 'attribute' && owner.kind === 'ref') || (existing.kind === 'ref' && owner.kind === 'attribute');
      report({
        code: 'COLUMN_NAME_COLLISION',
        severity: 'ERROR',
        ...elementOf(culprit),
        message:
          `La tabla "${gen.tableName}" tendria dos columnas "${column}": ${describe(existing)} y ${describe(owner)}.` +
          (isFkDuplicate ? ' Elimina el atributo: la relacion ya crea esa clave foranea.' : ''),
      });
    };
    claimColumn(gen.pkAttribute.columnName, { kind: 'pk' });
    for (const attr of gen.attributes) claimColumn(attr.columnName, { kind: 'attribute', attr, inherited: false });
    for (const ref of gen.singleRefs) claimColumn(ref.columnName, { kind: 'ref', ref, inherited: false });
  }

  // 4) Nombres de tabla (entidades + tablas intermedias N:M).
  const tables = new Map<string, string>();
  const claimTable = (table: string, label: string, elementType: ValidationIssue['elementType'], elementId: string) => {
    const existing = tables.get(table);
    if (!existing) {
      tables.set(table, label);
      return;
    }
    report({
      code: 'COLUMN_NAME_COLLISION',
      severity: 'ERROR',
      elementType,
      elementId,
      message: `Dos elementos generan la tabla "${table}": ${existing} y ${label}. Renombra una clase o ponle nombre a la relacion.`,
    });
  };
  for (const gen of genById.values()) claimTable(gen.tableName, `la clase "${gen.className}"`, 'CLASS', gen.umlClassId);
  for (const gen of genById.values()) {
    for (const ref of gen.manyRefs) {
      claimTable(ref.joinTableName, `la tabla intermedia de ${gen.className}-${ref.referencedClassName}`, 'RELATIONSHIP', refOrigin.get(ref)!.id);
    }
  }

  return {
    model: {
      packageName: `com.example.gen${shortId}`,
      databaseName: `gen_${shortId}`,
      classes: Array.from(genById.values()),
    },
    issues,
  };
}
