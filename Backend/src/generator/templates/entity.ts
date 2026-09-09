import { GenClass, GenerationModel } from '../GenerationModel';
import { capitalize, generatedFileHeader } from './javaUtil';

function generatedValueAnnotation(javaType: string): string {
  if (javaType === 'Long' || javaType === 'Integer') {
    return '    @GeneratedValue(strategy = GenerationType.IDENTITY)\n';
  }
  if (javaType === 'UUID') {
    return '    @GeneratedValue(strategy = GenerationType.UUID)\n';
  }
  return '';
}

export function renderEntity(model: GenerationModel, klass: GenClass): string {
  const imports = new Set<string>();
  for (const attr of klass.attributes) {
    if (attr.javaImport) imports.add(attr.javaImport);
  }
  if (klass.pkAttribute.javaImport) imports.add(klass.pkAttribute.javaImport);
  if (klass.manyRefs.length > 0) {
    imports.add('java.util.List');
    imports.add('java.util.ArrayList');
  }

  const fields: string[] = [];
  const gettersSetters: string[] = [];

  for (const attr of klass.attributes) {
    fields.push(`    @Column(name = "${attr.columnName}", nullable = ${attr.nullable})\n    private ${attr.javaType} ${attr.fieldName};`);
    gettersSetters.push(
      `    public ${attr.javaType} get${capitalize(attr.fieldName)}() {\n        return ${attr.fieldName};\n    }\n\n` +
        `    public void set${capitalize(attr.fieldName)}(${attr.javaType} ${attr.fieldName}) {\n        this.${attr.fieldName} = ${attr.fieldName};\n    }`,
    );
  }

  for (const ref of klass.singleRefs) {
    fields.push(
      `    @${ref.annotation}\n    @JoinColumn(name = "${ref.columnName}")\n    private ${ref.referencedClassName} ${ref.fieldName};`,
    );
    gettersSetters.push(
      `    public ${ref.referencedClassName} get${capitalize(ref.fieldName)}() {\n        return ${ref.fieldName};\n    }\n\n` +
        `    public void set${capitalize(ref.fieldName)}(${ref.referencedClassName} ${ref.fieldName}) {\n        this.${ref.fieldName} = ${ref.fieldName};\n    }`,
    );
  }

  for (const ref of klass.manyRefs) {
    fields.push(
      `    @ManyToMany\n` +
        `    @JoinTable(\n` +
        `        name = "${ref.joinTableName}",\n` +
        `        joinColumns = @JoinColumn(name = "${ref.joinColumnName}"),\n` +
        `        inverseJoinColumns = @JoinColumn(name = "${ref.inverseJoinColumnName}")\n` +
        `    )\n` +
        `    private List<${ref.referencedClassName}> ${ref.fieldName} = new ArrayList<>();`,
    );
    gettersSetters.push(
      `    public List<${ref.referencedClassName}> get${capitalize(ref.fieldName)}() {\n        return ${ref.fieldName};\n    }\n\n` +
        `    public void set${capitalize(ref.fieldName)}(List<${ref.referencedClassName}> ${ref.fieldName}) {\n        this.${ref.fieldName} = ${ref.fieldName};\n    }`,
    );
  }

  const importLines = Array.from(imports)
    .sort()
    .map((i) => `import ${i};`)
    .join('\n');

  return `${generatedFileHeader(`Entidad JPA de la clase UML "${klass.className}".`)}
package ${model.packageName}.model;

import jakarta.persistence.*;
${importLines ? importLines + '\n' : ''}
@Entity
@Table(name = "${klass.tableName}")
public class ${klass.className} {

    @Id
${generatedValueAnnotation(klass.pkAttribute.javaType)}    @Column(name = "${klass.pkAttribute.columnName}")
    private ${klass.pkAttribute.javaType} ${klass.pkAttribute.fieldName};

${fields.join('\n\n')}

    public ${klass.className}() {
    }

    public ${klass.pkAttribute.javaType} get${capitalize(klass.pkAttribute.fieldName)}() {
        return ${klass.pkAttribute.fieldName};
    }

    public void set${capitalize(klass.pkAttribute.fieldName)}(${klass.pkAttribute.javaType} ${klass.pkAttribute.fieldName}) {
        this.${klass.pkAttribute.fieldName} = ${klass.pkAttribute.fieldName};
    }

${gettersSetters.join('\n\n')}
}
`;
}
