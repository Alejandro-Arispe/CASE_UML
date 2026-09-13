import { UmlModel } from '../../../domain/entities';

// Resumen en texto plano del modelo actual, para darle contexto a la IA
// (seccion 28): asi puede referirse a clases/atributos existentes por
// nombre en vez de inventar un modelo desde cero cada vez.
export function buildModelSummary(model: UmlModel): string {
  if (model.classes.length === 0) {
    return 'El proyecto todavia no tiene clases.';
  }

  const nameOf = (id: string) => model.classes.find((c) => c.id === id)?.name ?? '?';

  const classesText = model.classes
    .map((klass) => {
      const attrs = klass.attributes.length
        ? klass.attributes
            .map((a) => `${a.name} (${a.type}${a.isPrimaryKey ? ', PK' : ''}${a.nullable ? '' : ', not null'})`)
            .join(', ')
        : 'sin atributos';
      return `- ${klass.name}: ${attrs}`;
    })
    .join('\n');

  const relationshipsText = model.relationships.length
    ? model.relationships
        .map((rel) => {
          const role = rel.name ? ` rol "${rel.name}"` : '';
          if (rel.kind === 'GENERALIZATION') {
            return `- GENERALIZATION: ${nameOf(rel.sourceClassId)} hereda de ${nameOf(rel.targetClassId)}`;
          }
          const associationClass = rel.associationClassId ? `, clase asociacion ${nameOf(rel.associationClassId)}` : '';
          return `- ${rel.kind}${role}: source ${nameOf(rel.sourceClassId)} "${rel.sourceMultiplicity}" -- "${rel.targetMultiplicity}" target ${nameOf(rel.targetClassId)}${associationClass}`;
        })
        .join('\n')
    : 'Sin relaciones.';

  return `Clases actuales:\n${classesText}\n\nRelaciones actuales:\n${relationshipsText}`;
}
