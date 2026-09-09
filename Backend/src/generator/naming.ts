// Normalizacion de nombres UML -> identificadores validos de Java/PostgreSQL
// (seccion 18). Es responsabilidad exclusiva del generador: no depende de
// la IA ni de lo que el usuario haya escrito en el editor.

const ACCENT_MARKS_REGEX = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function stripAccents(input: string): string {
  return input.normalize('NFD').replace(ACCENT_MARKS_REGEX, '');
}

function splitWords(input: string): string[] {
  const cleaned = stripAccents(input).replace(/[^a-zA-Z0-9]+/g, ' ');
  // Tambien separa uniones tipo camelCase/PascalCase ("DatosCliente" ->
  // "Datos Cliente"), para que un nombre de clase ya normalizado se pueda
  // volver a partir en palabras (necesario para derivar snake_case de un
  // className en PascalCase).
  const spaced = cleaned.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.trim().split(/\s+/).filter(Boolean);
}

// "Datos del Cliente" -> "DatosCliente"
export function toPascalCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) return 'Elemento';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

// "nombre completo" -> "nombreCompleto"
export function toCamelCase(input: string): string {
  const pascal = toPascalCase(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// "DatosCliente" -> "datos_cliente" (nombre de tabla/columna en PostgreSQL)
export function toSnakeCase(input: string): string {
  const pascal = toPascalCase(input);
  return pascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

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
