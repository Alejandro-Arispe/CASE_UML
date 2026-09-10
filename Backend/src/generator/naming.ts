// Normalizacion especifica del generador. Los identificadores base
// (PascalCase/camelCase/snake_case) viven en domain/naming.ts porque el
// validador tambien los necesita; aca solo queda lo que es exclusivo de
// generar un proyecto Spring Boot.

export { toPascalCase, toCamelCase, toSnakeCase } from '../domain/naming';
import { toSnakeCase } from '../domain/naming';

// Pluralizacion simple (no gramaticalmente perfecta, suficiente para rutas
// REST como "/api/clientes"): agrega "s" al nombre en snake_case.
export function toPluralSlug(className: string): string {
  return `${toSnakeCase(className)}s`;
}

// Identificador corto y estable a partir del UUID del proyecto, usado para
// el paquete Java y el nombre de la base de datos generada (no puede
// depender del nombre del proyecto porque el usuario lo puede cambiar).
export function shortProjectId(projectId: string): string {
  return projectId.replace(/-/g, '').slice(0, 12).toLowerCase();
}
