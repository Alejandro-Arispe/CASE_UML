// Normalizacion especifica del generador. Los identificadores base
// (PascalCase/camelCase/snake_case) viven en domain/naming.ts porque el
// validador tambien los necesita; aca solo queda lo que es exclusivo de
// generar un proyecto Spring Boot + PostgreSQL.

export { toPascalCase, toCamelCase, toSnakeCase } from '../domain/naming';
import { toCamelCase, toSnakeCase } from '../domain/naming';

// Pluralizacion basica en espanol (no perfecta, suficiente para rutas y
// nombres de colecciones): "autor" -> "autores", "direccion" ->
// "direcciones", "luz" -> "luces", "categoria" -> "categorias".
export function pluralizeWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (/[aeiou]$/.test(lower)) return `${word}s`;
  if (/z$/.test(lower)) return `${word.slice(0, -1)}${word.endsWith('Z') ? 'CES' : 'ces'}`;
  if (/[sx]$/.test(lower)) return word;
  // Palabras de origen extranjero terminadas en t/k ("carnet") hacen plural con -s.
  if (/[tk]$/.test(lower)) return `${word}s`;
  return `${word}es`;
}

// "carnet_estudiante" -> "carnet_estudiantes" (pluraliza solo la ultima palabra).
export function toPluralSlug(name: string): string {
  const parts = toSnakeCase(name).split('_');
  parts[parts.length - 1] = pluralizeWord(parts[parts.length - 1]);
  return parts.join('_');
}

// "CarnetEstudiante" -> "carnetEstudiantes"
export function toPluralCamelCase(name: string): string {
  const camel = toCamelCase(name);
  const match = camel.match(/^(.*?)([A-Z]?[a-z0-9]*)$/);
  if (!match) return `${camel}s`;
  const [, head, last] = match;
  return `${head}${pluralizeWord(last)}`;
}

// Identificador corto y estable a partir del UUID del proyecto, usado para
// el paquete Java y el nombre de la base de datos generada (no puede
// depender del nombre del proyecto porque el usuario lo puede cambiar).
export function shortProjectId(projectId: string): string {
  return projectId.replace(/-/g, '').slice(0, 12).toLowerCase();
}

// Palabras reservadas de Java: un campo llamado asi no compila.
export const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
  'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'var',
  'record', 'yield',
]);

// Nombres de clase que chocan con tipos que los archivos generados usan o
// importan (java.lang, colecciones, anotaciones JPA/Spring): una entidad
// llamada "Table" o "String" rompe la compilacion.
export const RESERVED_CLASS_NAMES = new Set([
  'Object', 'String', 'Integer', 'Long', 'Double', 'Boolean', 'Class', 'System', 'Math', 'Number', 'Void',
  'Record', 'Enum', 'Override', 'Exception', 'Error', 'Thread', 'List', 'ArrayList', 'Map', 'Set',
  'Collectors', 'UUID', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'Application', 'Entity', 'Table',
  'Column', 'Id', 'GeneratedValue', 'GenerationType', 'JoinColumn', 'JoinTable', 'ManyToOne', 'OneToOne',
  'ManyToMany', 'OneToMany', 'CascadeType', 'Inheritance', 'InheritanceType', 'PrimaryKeyJoinColumn',
  'Service', 'Repository', 'Autowired', 'RestController', 'RequestMapping', 'ResponseEntity', 'HttpStatus',
  'ResponseStatusException', 'Valid', 'NotNull', 'JpaRepository', 'Transactional',
]);

// Palabras reservadas de PostgreSQL: una tabla/columna llamada asi (muy
// comun: "user", "order", "group") hay que escribirla entre comillas.
const SQL_RESERVED = new Set([
  'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc', 'asymmetric', 'authorization', 'binary',
  'both', 'case', 'cast', 'check', 'collate', 'collation', 'column', 'concurrently', 'constraint', 'create',
  'cross', 'current_catalog', 'current_date', 'current_role', 'current_schema', 'current_time',
  'current_timestamp', 'current_user', 'default', 'deferrable', 'desc', 'distinct', 'do', 'else', 'end',
  'except', 'false', 'fetch', 'for', 'foreign', 'freeze', 'from', 'full', 'grant', 'group', 'having',
  'ilike', 'in', 'initially', 'inner', 'intersect', 'into', 'is', 'isnull', 'join', 'lateral', 'leading',
  'left', 'like', 'limit', 'localtime', 'localtimestamp', 'natural', 'not', 'notnull', 'null', 'offset', 'on',
  'only', 'or', 'order', 'outer', 'overlaps', 'placing', 'primary', 'references', 'returning', 'right',
  'select', 'session_user', 'similar', 'some', 'symmetric', 'system_user', 'table', 'tablesample', 'then',
  'to', 'trailing', 'true', 'union', 'unique', 'user', 'using', 'variadic', 'verbose', 'when', 'where',
  'window', 'with',
]);

export function isSqlReserved(identifier: string): boolean {
  return SQL_RESERVED.has(identifier.toLowerCase());
}

// Para usar dentro de un String de una anotacion Java: @Table(name = "\"user\"").
export function javaSqlName(identifier: string): string {
  return isSqlReserved(identifier) ? `\\"${identifier}\\"` : identifier;
}

// Para el schema.sql de referencia: "user".
export function sqlName(identifier: string): string {
  return isSqlReserved(identifier) ? `"${identifier}"` : identifier;
}
