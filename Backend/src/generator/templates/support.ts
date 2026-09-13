import { allManyRefs, allSingleRefs, GenerationModel } from '../GenerationModel';
import { generatedFileHeader } from './javaUtil';

// CORS abierto para desarrollo: sin esto, un frontend servido desde otro
// puerto (ej. Vite en 5173) no puede consumir la API generada.
export function renderWebConfig(model: GenerationModel): string {
  return `${generatedFileHeader('Configuracion CORS para desarrollo.')}
package ${model.packageName}.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*");
    }
}
`;
}

// Respuestas de error JSON consistentes: validacion (400), recurso no
// encontrado (404) y violaciones de integridad, como borrar un registro que
// otro referencia por FK (409), en vez de un 500 generico.
export function renderExceptionHandler(model: GenerationModel): string {
  return `${generatedFileHeader('Manejo global de errores de la API.')}
package ${model.packageName}.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException ex) {
        return body(HttpStatus.valueOf(ex.getStatusCode().value()), ex.getReason(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e -> fields.put(e.getField(), e.getDefaultMessage()));
        return body(HttpStatus.BAD_REQUEST, "Datos invalidos", fields);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "Solicitud mal formada", null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrity(DataIntegrityViolationException ex) {
        return body(HttpStatus.CONFLICT,
            "La operacion viola una restriccion de la base de datos (valor duplicado o registros relacionados que dependen de este)",
            null);
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus status, String message, Object details) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", status.value());
        response.put("error", message);
        if (details != null) {
            response.put("details", details);
        }
        return ResponseEntity.status(status).body(response);
    }
}
`;
}

export function renderReadme(
  model: GenerationModel,
  options: { artifactId: string; port: number; dbHost: string; dbPort: number },
): string {
  const endpoints = model.classes
    .map((klass) => {
      const extras = [
        ...allSingleRefs(klass).map((r) => `\`${r.fieldName}Id\`${r.optional ? '' : ' (obligatorio)'}`),
        ...allManyRefs(klass).map((r) => `\`${r.fieldName}Ids\` (lista)`),
      ];
      const inheritance = klass.parentClassName ? ` — hereda de ${klass.parentClassName}` : '';
      return `| ${klass.className}${inheritance} | \`/api/${klass.pluralSlug}\` | ${extras.length ? extras.join(', ') : '—'} |`;
    })
    .join('\n');

  return `# ${options.artifactId}

Backend Spring Boot + PostgreSQL generado automaticamente por **CASE_UML** a
partir del diagrama de clases.

## Requisitos

- Java 17+
- Maven 3.9+
- PostgreSQL (por defecto \`${options.dbHost}:${options.dbPort}\`, base \`${model.databaseName}\`)

## Ejecutar

\`\`\`bash
mvn spring-boot:run
\`\`\`

La conexion se puede cambiar con variables de entorno: \`DB_HOST\`, \`DB_PORT\`,
\`DB_NAME\`, \`DB_USERNAME\`, \`DB_PASSWORD\` y \`SERVER_PORT\`.

- API: http://localhost:${options.port}/api
- Swagger UI: http://localhost:${options.port}/swagger-ui.html

Hibernate crea/actualiza las tablas al arrancar (\`ddl-auto=update\`).
\`schema.sql\` es solo una referencia del esquema resultante.

## Endpoints

Cada entidad expone \`GET /\`, \`GET /{id}\`, \`POST /\`, \`PUT /{id}\` y \`DELETE /{id}\`.

| Entidad | Ruta | Referencias en el JSON |
|---|---|---|
${endpoints}

## Mapeo del diagrama

- **Herencia**: estrategia \`JOINED\` (una tabla por clase; la subclase comparte la PK del padre).
- **Asociacion 1 — \\***: la clase del lado "muchos" guarda la FK.
- **Asociacion 1 — 1**: FK con restriccion \`UNIQUE\`.
- **Asociacion \\* — \\***: tabla intermedia.
- **Composicion**: borrar el "todo" borra sus partes (\`cascade = ALL\`).
- **Clase asociacion**: entidad propia con FK obligatoria a cada extremo.
`;
}
