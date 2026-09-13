import { GenClass, GenerationModel } from '../GenerationModel';
import { generatedFileHeader, importLines } from './javaUtil';

// CRUD basico (seccion 33): sin filtros, paginacion, reportes ni permisos.
export function renderController(model: GenerationModel, klass: GenClass): string {
  const imports = [
    `${model.packageName}.dto.${klass.className}RequestDTO`,
    `${model.packageName}.dto.${klass.className}ResponseDTO`,
    `${model.packageName}.service.${klass.className}Service`,
    'jakarta.validation.Valid',
    'org.springframework.http.HttpStatus',
    'org.springframework.http.ResponseEntity',
    'org.springframework.web.bind.annotation.*',
    'java.util.List',
  ];
  if (klass.pkAttribute.javaImport) imports.push(klass.pkAttribute.javaImport);
  const pkType = klass.pkAttribute.javaType;

  return `${generatedFileHeader(`Controller REST de "${klass.className}".`)}
package ${model.packageName}.controller;

${importLines(imports)}
@RestController
@RequestMapping("/api/${klass.pluralSlug}")
public class ${klass.className}Controller {

    private final ${klass.className}Service service;

    public ${klass.className}Controller(${klass.className}Service service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<${klass.className}ResponseDTO> create(@Valid @RequestBody ${klass.className}RequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(dto));
    }

    @GetMapping
    public ResponseEntity<List<${klass.className}ResponseDTO>> findAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<${klass.className}ResponseDTO> findById(@PathVariable ${pkType} id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<${klass.className}ResponseDTO> update(
            @PathVariable ${pkType} id,
            @Valid @RequestBody ${klass.className}RequestDTO dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable ${pkType} id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
`;
}
