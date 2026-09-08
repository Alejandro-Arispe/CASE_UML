import { UmlModel } from '../../../domain/entities';

// Resumen en texto plano del modelo actual, para darle contexto a la IA
// (seccion 28): asi puede referirse a clases/atributos existentes por
// nombre en vez de inventar un modelo desde cero cada vez.
export function buildModelSummary(model: UmlModel): string {
  if (model.classes.length === 0) {
    return 'El proyecto todavia no tiene clases.';
  }

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
          const source = model.classes.find((c) => c.id === rel.sourceClassId)?.name ?? '?';
          const target = model.classes.find((c) => c.id === rel.targetClassId)?.name ?? '?';
          return `- ${source} (${rel.sourceMultiplicity}) -- ${rel.type} -- (${rel.targetMultiplicity}) ${target}`;
        })
        .join('\n')
    : 'Sin relaciones.';

  return `Clases actuales:\n${classesText}\n\nRelaciones actuales:\n${relationshipsText}`;
}
