import { Prisma, PrismaClient, Multiplicity as PrismaMultiplicity } from '@prisma/client';
import { Multiplicity, UmlAttribute, UmlClass, UmlModel, UmlRelationship } from '../../domain/entities';
import { UmlModelRepository } from '../../ports/out/UmlModelRepository';

const modelWithGraph = Prisma.validator<Prisma.UmlModelDefaultArgs>()({
  include: {
    classes: { include: { attributes: { orderBy: { sortOrder: 'asc' } } } },
    relationships: true,
  },
});

type UmlModelWithGraph = Prisma.UmlModelGetPayload<typeof modelWithGraph>;
type Tx = Prisma.TransactionClient;

const MULTIPLICITY_TO_DOMAIN: Record<PrismaMultiplicity, Multiplicity> = {
  ONE: '1',
  ZERO_OR_ONE: '0..1',
  MANY: '0..*',
  ONE_OR_MANY: '1..*',
};

const MULTIPLICITY_TO_PRISMA: Record<Multiplicity, PrismaMultiplicity> = {
  '1': 'ONE',
  '0..1': 'ZERO_OR_ONE',
  '0..*': 'MANY',
  '1..*': 'ONE_OR_MANY',
};

function toDomain(record: UmlModelWithGraph): UmlModel {
  return {
    id: record.id,
    projectId: record.projectId,
    revision: record.revision,
    classes: record.classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      position: { x: klass.positionX, y: klass.positionY },
      attributes: klass.attributes.map((attr) => ({
        id: attr.id,
        name: attr.name,
        type: attr.type,
        isPrimaryKey: attr.isPrimaryKey,
        nullable: attr.nullable,
        defaultValue: attr.defaultValue ?? undefined,
      })),
    })),
    relationships: record.relationships.map((rel) => ({
      id: rel.id,
      sourceClassId: rel.sourceClassId,
      targetClassId: rel.targetClassId,
      kind: rel.kind,
      sourceMultiplicity: MULTIPLICITY_TO_DOMAIN[rel.sourceMultiplicity],
      targetMultiplicity: MULTIPLICITY_TO_DOMAIN[rel.targetMultiplicity],
      name: rel.name ?? undefined,
      associationClassId: rel.associationClassId ?? undefined,
    })),
  };
}

function classRow(modelId: string, klass: UmlClass): Prisma.UmlClassCreateManyInput {
  return { id: klass.id, modelId, name: klass.name, positionX: klass.position.x, positionY: klass.position.y };
}

function attributeRow(classId: string, attr: UmlAttribute, sortOrder: number): Prisma.UmlAttributeCreateManyInput {
  return {
    id: attr.id,
    classId,
    name: attr.name,
    type: attr.type,
    isPrimaryKey: attr.isPrimaryKey,
    nullable: attr.nullable,
    defaultValue: attr.defaultValue ?? null,
    sortOrder,
  };
}

function relationshipRow(modelId: string, rel: UmlRelationship): Prisma.UmlRelationshipCreateManyInput {
  return {
    id: rel.id,
    modelId,
    sourceClassId: rel.sourceClassId,
    targetClassId: rel.targetClassId,
    kind: rel.kind,
    sourceMultiplicity: MULTIPLICITY_TO_PRISMA[rel.sourceMultiplicity],
    targetMultiplicity: MULTIPLICITY_TO_PRISMA[rel.targetMultiplicity],
    name: rel.name ?? null,
    associationClassId: rel.associationClassId ?? null,
  };
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class PrismaUmlModelRepository implements UmlModelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProjectId(projectId: string): Promise<UmlModel | null> {
    const record = await this.prisma.umlModel.findUnique({
      where: { projectId },
      ...modelWithGraph,
    });
    return record ? toDomain(record) : null;
  }

  // Guarda el grafo condicionado a que la revision en base siga siendo la
  // que el llamador leyo (`expectedRevision`): sin este chequeo, dos
  // ediciones concurrentes que parten de la misma revision pisarian en
  // silencio el cambio de la otra (lost update). Devuelve `false` sin
  // escribir nada si alguien mas ya avanzo la revision.
  //
  // Si se pasa `previous` (el modelo leido en esa revision), solo se
  // escriben las diferencias: mover una clase es un UPDATE de una fila en
  // vez de borrar y reinsertar todo el diagrama. Sin `previous` (importar,
  // reemplazo total) se reemplaza el grafo completo.
  async save(model: UmlModel, expectedRevision: number | null, previous?: UmlModel | null): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        if (expectedRevision === null) {
          // `projectId` es @unique: un intento concurrente de crear el mismo
          // modelo choca con esa restriccion en vez de pisar filas.
          try {
            await tx.umlModel.create({
              data: { id: model.id, projectId: model.projectId, revision: model.revision },
            });
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
              return false;
            }
            throw err;
          }
        } else {
          const result = await tx.umlModel.updateMany({
            where: { id: model.id, revision: expectedRevision },
            data: { revision: model.revision },
          });
          if (result.count === 0) {
            return false;
          }
        }

        if (previous && expectedRevision !== null) {
          await this.saveDiff(tx, model, previous);
        } else {
          await this.replaceGraph(tx, model);
        }
        return true;
      },
      { timeout: 30_000 },
    );
  }

  private async replaceGraph(tx: Tx, model: UmlModel) {
    await tx.umlRelationship.deleteMany({ where: { modelId: model.id } });
    await tx.umlClass.deleteMany({ where: { modelId: model.id } });

    await tx.umlClass.createMany({ data: model.classes.map((c) => classRow(model.id, c)) });
    await tx.umlAttribute.createMany({
      data: model.classes.flatMap((c) => c.attributes.map((a, i) => attributeRow(c.id, a, i))),
    });
    await tx.umlRelationship.createMany({ data: model.relationships.map((r) => relationshipRow(model.id, r)) });
  }

  private async saveDiff(tx: Tx, model: UmlModel, previous: UmlModel) {
    const prevClasses = new Map(previous.classes.map((c) => [c.id, c]));
    const nextClasses = new Map(model.classes.map((c) => [c.id, c]));
    const prevRels = new Map(previous.relationships.map((r) => [r.id, r]));
    const nextRelIds = new Set(model.relationships.map((r) => r.id));

    // 1) Borrados (relaciones -> atributos -> clases).
    const removedRelIds = previous.relationships.filter((r) => !nextRelIds.has(r.id)).map((r) => r.id);
    if (removedRelIds.length) await tx.umlRelationship.deleteMany({ where: { id: { in: removedRelIds } } });

    const removedAttrIds: string[] = [];
    for (const [id, prevClass] of prevClasses) {
      const nextClass = nextClasses.get(id);
      if (!nextClass) continue;
      const nextAttrIds = new Set(nextClass.attributes.map((a) => a.id));
      removedAttrIds.push(...prevClass.attributes.filter((a) => !nextAttrIds.has(a.id)).map((a) => a.id));
    }
    if (removedAttrIds.length) await tx.umlAttribute.deleteMany({ where: { id: { in: removedAttrIds } } });

    const removedClassIds = previous.classes.filter((c) => !nextClasses.has(c.id)).map((c) => c.id);
    if (removedClassIds.length) await tx.umlClass.deleteMany({ where: { id: { in: removedClassIds } } });

    // 2) Clases nuevas y modificadas (antes que atributos y relaciones que
    //    las referencian).
    const newClasses = model.classes.filter((c) => !prevClasses.has(c.id));
    if (newClasses.length) await tx.umlClass.createMany({ data: newClasses.map((c) => classRow(model.id, c)) });

    for (const klass of model.classes) {
      const prev = prevClasses.get(klass.id);
      if (prev && (prev.name !== klass.name || !sameJson(prev.position, klass.position))) {
        await tx.umlClass.update({
          where: { id: klass.id },
          data: { name: klass.name, positionX: klass.position.x, positionY: klass.position.y },
        });
      }
    }

    // 3) Atributos nuevos y modificados.
    const newAttributes: Prisma.UmlAttributeCreateManyInput[] = [];
    for (const klass of model.classes) {
      const prevAttrs = new Map((prevClasses.get(klass.id)?.attributes ?? []).map((a, i) => [a.id, { attr: a, index: i }]));
      for (const [index, attr] of klass.attributes.entries()) {
        const prev = prevAttrs.get(attr.id);
        if (!prev) {
          newAttributes.push(attributeRow(klass.id, attr, index));
        } else if (!sameJson(prev.attr, attr) || prev.index !== index) {
          const { id: _id, classId: _classId, ...data } = attributeRow(klass.id, attr, index);
          await tx.umlAttribute.update({ where: { id: attr.id }, data });
        }
      }
    }
    if (newAttributes.length) await tx.umlAttribute.createMany({ data: newAttributes });

    // 4) Relaciones nuevas y modificadas.
    const newRels = model.relationships.filter((r) => !prevRels.has(r.id));
    if (newRels.length) await tx.umlRelationship.createMany({ data: newRels.map((r) => relationshipRow(model.id, r)) });

    for (const rel of model.relationships) {
      const prev = prevRels.get(rel.id);
      if (prev && !sameJson(prev, rel)) {
        const { id: _id, modelId: _modelId, ...data } = relationshipRow(model.id, rel);
        await tx.umlRelationship.update({ where: { id: rel.id }, data });
      }
    }
  }
}
