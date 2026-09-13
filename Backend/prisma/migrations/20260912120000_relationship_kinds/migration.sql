-- Relaciones de diagrama de clases completas (compatibles con Enterprise
-- Architect): tipo de relacion (asociacion, agregacion, composicion,
-- herencia), multiplicidades 0..1 / 1..*, nombre/rol y clase asociacion.
-- El antiguo "type" (ONE_TO_MANY, ...) se elimina: la cardinalidad ahora se
-- deriva de las multiplicidades, que es lo que el usuario ve en el diagrama.

-- AlterEnum
ALTER TYPE "Multiplicity" ADD VALUE 'ZERO_OR_ONE';
ALTER TYPE "Multiplicity" ADD VALUE 'ONE_OR_MANY';

-- CreateEnum
CREATE TYPE "RelationshipKind" AS ENUM ('ASSOCIATION', 'AGGREGATION', 'COMPOSITION', 'GENERALIZATION');

-- AlterTable
ALTER TABLE "UmlAttribute" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UmlRelationship" DROP COLUMN "type",
ADD COLUMN     "associationClassId" TEXT,
ADD COLUMN     "kind" "RelationshipKind" NOT NULL DEFAULT 'ASSOCIATION',
ADD COLUMN     "name" TEXT;

-- DropEnum
DROP TYPE "RelationshipType";

-- AddForeignKey
ALTER TABLE "UmlRelationship" ADD CONSTRAINT "UmlRelationship_associationClassId_fkey" FOREIGN KEY ("associationClassId") REFERENCES "UmlClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
