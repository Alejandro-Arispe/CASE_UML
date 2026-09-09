import { GenerationModel } from '../GenerationModel';

// Representacion UML -> PostgreSQL (seccion 37). Es un artefacto de
// referencia: no se coloca en src/main/resources para que Spring Boot no
// intente ejecutarlo el mismo tiempo que Hibernate administra el esquema.
export function renderSchemaSql(model: GenerationModel): string {
  const statements: string[] = [];

  for (const klass of model.classes) {
    const columns = [`    ${klass.pkAttribute.columnName} ${klass.pkAttribute.sqlType} PRIMARY KEY`];
    for (const attr of klass.attributes) {
      columns.push(`    ${attr.columnName} ${attr.sqlType}${attr.nullable ? '' : ' NOT NULL'}`);
    }
    for (const ref of klass.singleRefs) {
      const referencedClass = model.classes.find((c) => c.className === ref.referencedClassName);
      columns.push(
        `    ${ref.columnName} ${referencedClass?.pkAttribute.sqlType ?? 'BIGINT'} REFERENCES ${referencedClass?.tableName ?? ref.referencedClassName.toLowerCase()}(${referencedClass?.pkAttribute.columnName ?? 'id'})`,
      );
    }

    statements.push(`CREATE TABLE ${klass.tableName} (\n${columns.join(',\n')}\n);`);
  }

  for (const klass of model.classes) {
    for (const ref of klass.manyRefs) {
      const referencedClass = model.classes.find((c) => c.className === ref.referencedClassName);
      statements.push(
        `CREATE TABLE ${ref.joinTableName} (\n` +
          `    ${ref.joinColumnName} ${klass.pkAttribute.sqlType} REFERENCES ${klass.tableName}(${klass.pkAttribute.columnName}),\n` +
          `    ${ref.inverseJoinColumnName} ${referencedClass?.pkAttribute.sqlType ?? 'BIGINT'} REFERENCES ${referencedClass?.tableName ?? ref.referencedClassName.toLowerCase()}(${referencedClass?.pkAttribute.columnName ?? 'id'}),\n` +
          `    PRIMARY KEY (${ref.joinColumnName}, ${ref.inverseJoinColumnName})\n` +
          `);`,
      );
    }
  }

  return (
    `-- Generado automaticamente por CASE_UML a partir del modelo UML.\n` +
    `-- Representa la conversion UML -> PostgreSQL (seccion 37); en tiempo de\n` +
    `-- ejecucion, Hibernate administra el esquema real (ddl-auto=update).\n\n` +
    statements.join('\n\n') +
    '\n'
  );
}
