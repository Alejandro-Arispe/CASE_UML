import { GenClass, GenerationModel } from '../GenerationModel';
import { generatedFileHeader, importLines } from './javaUtil';

export function renderRepository(model: GenerationModel, klass: GenClass): string {
  const imports = [`${model.packageName}.model.${klass.className}`, 'org.springframework.data.jpa.repository.JpaRepository'];
  if (klass.pkAttribute.javaImport) imports.push(klass.pkAttribute.javaImport);

  return `${generatedFileHeader(`Repositorio JPA de "${klass.className}".`)}
package ${model.packageName}.repository;

${importLines(imports)}
public interface ${klass.className}Repository extends JpaRepository<${klass.className}, ${klass.pkAttribute.javaType}> {
}
`;
}
