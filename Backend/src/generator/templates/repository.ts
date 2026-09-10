import { GenClass, GenerationModel } from '../GenerationModel';
import { generatedFileHeader } from './javaUtil';

export function renderRepository(model: GenerationModel, klass: GenClass): string {
  const pkImport = klass.pkAttribute.javaImport ? `import ${klass.pkAttribute.javaImport};\n` : '';

  return `${generatedFileHeader(`Repositorio JPA de "${klass.className}".`)}
package ${model.packageName}.repository;

import ${model.packageName}.model.${klass.className};
import org.springframework.data.jpa.repository.JpaRepository;
${pkImport}
public interface ${klass.className}Repository extends JpaRepository<${klass.className}, ${klass.pkAttribute.javaType}> {
}
`;
}
