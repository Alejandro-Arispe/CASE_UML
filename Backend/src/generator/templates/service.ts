import { GenClass, GenerationModel } from '../GenerationModel';
import { capitalize, generatedFileHeader } from './javaUtil';

function repoVar(className: string): string {
  return `${className.charAt(0).toLowerCase()}${className.slice(1)}Repository`;
}

// Convierte el DTO de entrada en la entidad y resuelve las referencias
// (por id) hacia otras clases usando su repositorio.
function applyDtoBody(klass: GenClass): string {
  const lines: string[] = [];
  for (const attr of klass.attributes) {
    lines.push(`        entity.set${capitalize(attr.fieldName)}(dto.get${capitalize(attr.fieldName)}());`);
  }
  for (const ref of klass.singleRefs) {
    const idGetter = `dto.get${capitalize(ref.fieldName)}Id()`;
    lines.push(
      `        if (${idGetter} != null) {\n` +
        `            entity.set${capitalize(ref.fieldName)}(${repoVar(ref.referencedClassName)}.findById(${idGetter}).orElse(null));\n` +
        `        }`,
    );
  }
  return lines.join('\n');
}

function toResponseDtoBody(klass: GenClass, model: GenerationModel): string {
  const lines: string[] = [`        dto.setId(entity.get${capitalize(klass.pkAttribute.fieldName)}());`];
  for (const attr of klass.attributes) {
    lines.push(`        dto.set${capitalize(attr.fieldName)}(entity.get${capitalize(attr.fieldName)}());`);
  }
  for (const ref of klass.singleRefs) {
    const referencedClass = model.classes.find((c) => c.className === ref.referencedClassName);
    const pkGetter = `get${capitalize(referencedClass?.pkAttribute.fieldName ?? 'id')}`;
    lines.push(
      `        dto.set${capitalize(ref.fieldName)}Id(entity.get${capitalize(ref.fieldName)}() != null ? entity.get${capitalize(ref.fieldName)}().${pkGetter}() : null);`,
    );
  }
  return lines.join('\n');
}

export function renderService(model: GenerationModel, klass: GenClass): string {
  // Repositorios de otras clases que hacen falta para resolver las
  // referencias por id (seccion 34).
  const referencedRepos = Array.from(new Map(klass.singleRefs.map((r) => [r.referencedClassName, r])).values());

  const autowiredRefs = referencedRepos
    .map(
      (ref) =>
        `    @Autowired\n    private ${ref.referencedClassName}Repository ${repoVar(ref.referencedClassName)};`,
    )
    .join('\n\n');

  const refImports = referencedRepos
    .map((ref) => `import ${model.packageName}.repository.${ref.referencedClassName}Repository;`)
    .join('\n');

  return `${generatedFileHeader(`Servicio de "${klass.className}": CRUD basico (seccion 33).`)}
package ${model.packageName}.service;

import ${model.packageName}.model.${klass.className};
import ${model.packageName}.repository.${klass.className}Repository;
${refImports ? refImports + '\n' : ''}import ${model.packageName}.dto.${klass.className}RequestDTO;
import ${model.packageName}.dto.${klass.className}ResponseDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ${klass.className}Service {

    @Autowired
    private ${klass.className}Repository repository;

${autowiredRefs ? autowiredRefs + '\n\n' : ''}    public List<${klass.className}ResponseDTO> findAll() {
        return repository.findAll().stream().map(this::toResponseDTO).collect(Collectors.toList());
    }

    public ${klass.className}ResponseDTO findById(${klass.pkAttribute.javaType} id) {
        ${klass.className} entity = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("${klass.className} no encontrado: " + id));
        return toResponseDTO(entity);
    }

    public ${klass.className}ResponseDTO create(${klass.className}RequestDTO dto) {
        ${klass.className} entity = new ${klass.className}();
        applyDto(entity, dto);
        return toResponseDTO(repository.save(entity));
    }

    public ${klass.className}ResponseDTO update(${klass.pkAttribute.javaType} id, ${klass.className}RequestDTO dto) {
        ${klass.className} entity = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("${klass.className} no encontrado: " + id));
        applyDto(entity, dto);
        return toResponseDTO(repository.save(entity));
    }

    public void delete(${klass.pkAttribute.javaType} id) {
        repository.deleteById(id);
    }

    private void applyDto(${klass.className} entity, ${klass.className}RequestDTO dto) {
${applyDtoBody(klass)}
    }

    private ${klass.className}ResponseDTO toResponseDTO(${klass.className} entity) {
        ${klass.className}ResponseDTO dto = new ${klass.className}ResponseDTO();
${toResponseDtoBody(klass, model)}
        return dto;
    }
}
`;
}
