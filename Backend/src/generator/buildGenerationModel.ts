import { UmlModel } from '../domain/entities';
import { DomainError } from '../domain/errors/DomainError';
import { GenAttribute, GenClass, GenerationModel } from './GenerationModel';
import { shortProjectId, toCamelCase, toPascalCase, toPluralSlug, toSnakeCase } from './naming';
import { JAVA_IMPORT, JAVA_TYPE, SQL_TYPE } from './typeMapping';

// Traduce el UML validado (seccion 17 ya paso) al modelo intermedio del
// generador: normaliza nombres, resuelve el lado propietario de cada
// relacion y deja todo lo que los templates necesitan sin tener que volver
// a consultar el modelo UML original.
export function buildGenerationModel(model: UmlModel, projectId: string): GenerationModel {
  const shortId = shortProjectId(projectId);
  const packageName = `com.example.gen${shortId}`;
  const databaseName = `gen_${shortId}`;

  const classesById = new Map(model.classes.map((c) => [c.id, c]));

  const genClasses = new Map<string, GenClass>();
  for (const klass of model.classes) {
    const className = toPascalCase(klass.name);
    const attributes: GenAttribute[] = klass.attributes.map((attr) => ({
      fieldName: toCamelCase(attr.name),
      columnName: toSnakeCase(attr.name),
      javaType: JAVA_TYPE[attr.type],
      sqlType: SQL_TYPE[attr.type],
      javaImport: JAVA_IMPORT[attr.type],
      nullable: attr.nullable,
      isPrimaryKey: attr.isPrimaryKey,
      defaultValue: attr.defaultValue,
    }));

    const pkAttribute = attributes.find((a) => a.isPrimaryKey);
    if (!pkAttribute) {
      // El validador (Fase 9) deberia haber bloqueado esto antes de llegar
      // aqui; esto es una red de seguridad, no el mecanismo principal.
      throw new DomainError(`La clase "${className}" no tiene clave primaria`);
    }

    genClasses.set(klass.id, {
      umlClassId: klass.id,
      className,
      tableName: toSnakeCase(klass.name),
      pluralSlug: toPluralSlug(klass.name),
      pkAttribute,
      attributes: attributes.filter((a) => !a.isPrimaryKey),
      singleRefs: [],
      manyRefs: [],
    });
  }

  for (const rel of model.relationships) {
    const sourceUml = classesById.get(rel.sourceClassId);
    const targetUml = classesById.get(rel.targetClassId);
    if (!sourceUml || !targetUml) continue; // el validador ya deberia haber bloqueado esto

    const source = genClasses.get(rel.sourceClassId)!;
    const target = genClasses.get(rel.targetClassId)!;

    switch (rel.type) {
      case 'ONE_TO_ONE':
        source.singleRefs.push({
          fieldName: toCamelCase(target.className),
          columnName: `${target.tableName}_id`,
          referencedClassName: target.className,
          referencedPkJavaType: target.pkAttribute.javaType,
          referencedPkJavaImport: target.pkAttribute.javaImport,
          annotation: 'OneToOne',
        });
        break;

      case 'ONE_TO_MANY':
        // "source (1) -- N (target)": el lado N es quien tiene la FK
        // (seccion 42: pedido.cliente_id -> cliente.id).
        target.singleRefs.push({
          fieldName: toCamelCase(source.className),
          columnName: `${source.tableName}_id`,
          referencedClassName: source.className,
          referencedPkJavaType: source.pkAttribute.javaType,
          referencedPkJavaImport: source.pkAttribute.javaImport,
          annotation: 'ManyToOne',
        });
        break;

      case 'MANY_TO_ONE':
        source.singleRefs.push({
          fieldName: toCamelCase(target.className),
          columnName: `${target.tableName}_id`,
          referencedClassName: target.className,
          referencedPkJavaType: target.pkAttribute.javaType,
          referencedPkJavaImport: target.pkAttribute.javaImport,
          annotation: 'ManyToOne',
        });
        break;

      case 'MANY_TO_MANY':
        source.manyRefs.push({
          fieldName: `${toCamelCase(target.className)}s`,
          referencedClassName: target.className,
          referencedPkJavaType: target.pkAttribute.javaType,
          referencedPkJavaImport: target.pkAttribute.javaImport,
          joinTableName: `${source.tableName}_${target.tableName}`,
          joinColumnName: `${source.tableName}_id`,
          inverseJoinColumnName: `${target.tableName}_id`,
        });
        break;
    }
  }

  return { packageName, databaseName, classes: Array.from(genClasses.values()) };
}
