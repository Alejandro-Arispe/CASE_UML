import { GenerationModel } from '../GenerationModel';
import { sqlName } from '../naming';

// Representacion UML -> PostgreSQL (seccion 37). Es un artefacto de
// referencia: no se coloca en src/main/resources para que Spring Boot no
// intente ejecutarlo al mismo tiempo que Hibernate administra el esquema.
export function renderSchemaSql(model: GenerationModel): string {
  const byName = new Map(model.classes.map((c) => [c.className, c]));
  const statements: string[] = [];
  const constraints: string[] = [];

  // Las clases padre primero, para que la FK de la subclase a su padre
  // apunte a una tabla ya creada.
  const depth = (className: string): number => {
    const parent = byName.get(className)?.parentClassName;
    return parent ? 1 + depth(parent) : 0;
  };
  const ordered = [...model.classes].sort((a, b) => depth(a.className) - depth(b.className));

  for (const klass of ordered) {
    const pk = klass.pkAttribute;
    const columns = [`    ${sqlName(pk.columnName)} ${pk.sqlType} PRIMARY KEY`];
    if (klass.parentClassName) {
      const parent = byName.get(klass.parentClassName)!;
      constraints.push(
        `ALTER TABLE ${sqlName(klass.tableName)} ADD FOREIGN KEY (${sqlName(pk.columnName)}) REFERENCES ${sqlName(parent.tableName)}(${sqlName(pk.columnName)}) ON DELETE CASCADE;`,
      );
    }
    for (const attr of klass.attributes) {
      columns.push(`    ${sqlName(attr.columnName)} ${attr.sqlType}${attr.nullable ? '' : ' NOT NULL'}`);
    }
    for (const ref of klass.singleRefs) {
      const referenced = byName.get(ref.referencedClassName)!;
      columns.push(
        `    ${sqlName(ref.columnName)} ${referenced.pkAttribute.sqlType}${ref.optional ? '' : ' NOT NULL'}${ref.unique ? ' UNIQUE' : ''}`,
      );
      const isComposition = referenced.composedCollections.some(
        (c) => c.partClassName === klass.className && c.mappedBy === ref.fieldName,
      );
      constraints.push(
        `ALTER TABLE ${sqlName(klass.tableName)} ADD FOREIGN KEY (${sqlName(ref.columnName)}) REFERENCES ${sqlName(referenced.tableName)}(${sqlName(referenced.pkAttribute.columnName)})${isComposition ? ' ON DELETE CASCADE' : ''};`,
      );
    }

    statements.push(`CREATE TABLE ${sqlName(klass.tableName)} (\n${columns.join(',\n')}\n);`);
  }

  for (const klass of model.classes) {
    for (const ref of klass.manyRefs) {
      const referenced = byName.get(ref.referencedClassName)!;
      statements.push(
        `CREATE TABLE ${sqlName(ref.joinTableName)} (\n` +
          `    ${sqlName(ref.joinColumnName)} ${klass.pkAttribute.sqlType} NOT NULL REFERENCES ${sqlName(klass.tableName)}(${sqlName(klass.pkAttribute.columnName)}),\n` +
          `    ${sqlName(ref.inverseJoinColumnName)} ${referenced.pkAttribute.sqlType} NOT NULL REFERENCES ${sqlName(referenced.tableName)}(${sqlName(referenced.pkAttribute.columnName)}),\n` +
          `    PRIMARY KEY (${sqlName(ref.joinColumnName)}, ${sqlName(ref.inverseJoinColumnName)})\n` +
          `);`,
      );
    }
  }

  return (
    `-- Generado automaticamente por CASE_UML a partir del modelo UML.\n` +
    `-- Representa la conversion UML -> PostgreSQL (seccion 37); en tiempo de\n` +
    `-- ejecucion, Hibernate administra el esquema real (ddl-auto=update).\n\n` +
    statements.join('\n\n') +
    (constraints.length ? `\n\n${constraints.join('\n')}` : '') +
    '\n'
  );
}
