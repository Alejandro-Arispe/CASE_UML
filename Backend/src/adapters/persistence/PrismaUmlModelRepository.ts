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
  // transaccion. Es la estrategia mas simple y correcta para este alcance;
  // la persistencia incremental por operacion (agregar un atributo, mover
  // una clase) se agrega junto con el motor de edicion/colaboracion.
  async save(model: UmlModel): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.umlModel.upsert({
        where: { id: model.id },
        create: { id: model.id, projectId: model.projectId, revision: model.revision },
        update: { revision: model.revision },
      });

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
    });
  }
}
