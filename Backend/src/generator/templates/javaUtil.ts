// Capitaliza la primera letra de un fieldName ya en camelCase, para
// construir nombres de metodo Java (getNombre/setNombre).
export function capitalize(fieldName: string): string {
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
}

// Header identico en todos los archivos generados: deja claro que no se
// edita a mano y de donde sale (seccion 31: generacion deterministica).
export function generatedFileHeader(description: string): string {
  return `// Archivo generado automaticamente por CASE_UML a partir del modelo UML.\n// ${description}\n// No editar a mano: los cambios se pierden al regenerar (seccion 40).\n`;
}
