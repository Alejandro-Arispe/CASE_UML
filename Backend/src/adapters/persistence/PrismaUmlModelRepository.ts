import { Prisma, PrismaClient, Multiplicity as PrismaMultiplicity } from '@prisma/client';
import { Multiplicity, UmlModel } from '../../domain/entities';
import { UmlModelRepository } from '../../ports/out/UmlModelRepository';

const modelWithGraph = Prisma.validator<Prisma.UmlModelDefaultArgs>()({
  include: {
    classes: { include: { attributes: true } },
    relationships: true,
  },
});

type UmlModelWithGraph = Prisma.UmlModelGetPayload<typeof modelWithGraph>;

function multiplicityToDomain(value: PrismaMultiplicity): Multiplicity {
  return value === 'ONE' ? '1' : 'N';
}

function multiplicityToPrisma(value: Multiplicity): PrismaMultiplicity {
  return value === '1' ? 'ONE' : 'MANY';
}

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
      type: rel.type,
      sourceMultiplicity: multiplicityToDomain(rel.sourceMultiplicity),
      targetMultiplicity: multiplicityToDomain(rel.targetMultiplicity),
    })),
  };
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

  // Reemplaza el grafo completo (clases, atributos, relaciones) en una
  // transaccion, condicionado a que la revision en base siga siendo la que
  // el llamador leyo (`expectedRevision`): sin este chequeo, dos ediciones
  // concurrentes que ambas parten de la misma revision pueden calcular
  // "revision+1" por separado y la segunda en escribir pisa en silencio el
  // cambio de la primera (lost update). Devuelve `false` sin escribir nada
  // si alguien mas ya avanzo la revision entre la lectura y este intento.
  async save(model: UmlModel, expectedRevision: number | null): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      if (expectedRevision === null) {
        // El llamador cree que el modelo todavia no existe: crear es
        // seguro porque `projectId` es @unique, asi que un intento
        // concurrente de crear el mismo proyecto choca con esa restriccion
        // en vez de pisar filas.
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

      await tx.umlRelationship.deleteMany({ where: { modelId: model.id } });
      await tx.umlClass.deleteMany({ where: { modelId: model.id } });

      for (const klass of model.classes) {
        await tx.umlClass.create({
          data: {
            id: klass.id,
            modelId: model.id,
            name: klass.name,
            positionX: klass.position.x,
            positionY: klass.position.y,
            attributes: {
              create: klass.attributes.map((attr) => ({
                id: attr.id,
                name: attr.name,
                type: attr.type,
                isPrimaryKey: attr.isPrimaryKey,
                nullable: attr.nullable,
                defaultValue: attr.defaultValue,
              })),
            },
          },
        });
      }

      for (const rel of model.relationships) {
        await tx.umlRelationship.create({
          data: {
            id: rel.id,
            modelId: model.id,
            sourceClassId: rel.sourceClassId,
            targetClassId: rel.targetClassId,
            type: rel.type,
            sourceMultiplicity: multiplicityToPrisma(rel.sourceMultiplicity),
            targetMultiplicity: multiplicityToPrisma(rel.targetMultiplicity),
          },
        });
      }

      return true;
    });
  }
}
