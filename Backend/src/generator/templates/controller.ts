import { GenClass, GenerationModel } from '../GenerationModel';
import { generatedFileHeader } from './javaUtil';

// CRUD basico (seccion 33): sin filtros, paginacion, reportes ni permisos.
export function renderController(model: GenerationModel, klass: GenClass): string {
  const pkImport = klass.pkAttribute.javaImport ? `import ${klass.pkAttribute.javaImport};\n` : '';

  return `${generatedFileHeader(`Controller REST de "${klass.className}".`)}
package ${model.packageName}.controller;

import ${model.packageName}.dto.${klass.className}RequestDTO;
import ${model.packageName}.dto.${klass.className}ResponseDTO;
import ${model.packageName}.service.${klass.className}Service;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

${pkImport}import java.util.List;

@RestController
@RequestMapping("/api/${klass.pluralSlug}")
public class ${klass.className}Controller {

    @Autowired
    private ${klass.className}Service service;

    @PostMapping
    public ResponseEntity<${klass.className}ResponseDTO> create(@Valid @RequestBody ${klass.className}RequestDTO dto) {
        return ResponseEntity.ok(service.create(dto));
    }

    @GetMapping
    public ResponseEntity<List<${klass.className}ResponseDTO>> findAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<${klass.className}ResponseDTO> findById(@PathVariable ${klass.pkAttribute.javaType} id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<${klass.className}ResponseDTO> update(
            @PathVariable ${klass.pkAttribute.javaType} id,
            @Valid @RequestBody ${klass.className}RequestDTO dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable ${klass.pkAttribute.javaType} id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
`;
}
