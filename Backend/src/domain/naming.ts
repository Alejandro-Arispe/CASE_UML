// Normalizacion de nombres UML -> identificadores validos de Java (seccion
// 18). Vive en domain/ (no en generator/) porque tanto el validador
// (domain/validation) como el generador necesitan derivar EXACTAMENTE el
// mismo identificador a partir de un nombre: si usaran normalizaciones
// distintas, un modelo podria pasar la validacion y seguir rompiendo la
// generacion (ver seccion "nombres que colisionan despues de normalizacion").

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

// Java no permite identificadores que empiecen con un digito ("3dModel" no
// compila). Si la primera palabra normalizada empieza con un digito, se le
// antepone un prefijo neutro para garantizar que el identificador generado
// siempre sea valido, sin importar que haya escrito el usuario.
function ensureValidIdentifierStart(joined: string): string {
  return /^[0-9]/.test(joined) ? `Elemento${joined}` : joined;
}

// "Datos del Cliente" -> "DatosCliente"
export function toPascalCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) return 'Elemento';
  const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return ensureValidIdentifierStart(joined);
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
