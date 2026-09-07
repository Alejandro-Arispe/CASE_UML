-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "UmlDataType" AS ENUM ('String', 'Integer', 'Long', 'Double', 'Boolean', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'UUID');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY');

-- CreateEnum
CREATE TYPE "Multiplicity" AS ENUM ('ONE', 'MANY');

-- CreateEnum
CREATE TYPE "EditOperation" AS ENUM ('CREATE_CLASS', 'DELETE_CLASS', 'RENAME_CLASS', 'ADD_ATTRIBUTE', 'REMOVE_ATTRIBUTE', 'UPDATE_ATTRIBUTE', 'CREATE_RELATIONSHIP', 'UPDATE_RELATIONSHIP', 'DELETE_RELATIONSHIP', 'SET_MULTIPLICITY', 'MOVE_ELEMENT');

-- CreateEnum
CREATE TYPE "EditElementType" AS ENUM ('CLASS', 'ATTRIBUTE', 'RELATIONSHIP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmlModel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UmlModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmlClass" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "UmlClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmlAttribute" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UmlDataType" NOT NULL,
    "isPrimaryKey" BOOLEAN NOT NULL DEFAULT false,
    "nullable" BOOLEAN NOT NULL DEFAULT true,
    "defaultValue" TEXT,

    CONSTRAINT "UmlAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmlRelationship" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "sourceClassId" TEXT NOT NULL,
    "targetClassId" TEXT NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "sourceMultiplicity" "Multiplicity" NOT NULL,
    "targetMultiplicity" "Multiplicity" NOT NULL,

    CONSTRAINT "UmlRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" "EditOperation" NOT NULL,
    "elementType" "EditElementType" NOT NULL,
    "elementId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL,

    CONSTRAINT "EditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_inviteCode_key" ON "Project"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UmlModel_projectId_key" ON "UmlModel"("projectId");

-- CreateIndex
CREATE INDEX "EditHistory_projectId_timestamp_idx" ON "EditHistory"("projectId", "timestamp");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmlModel" ADD CONSTRAINT "UmlModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmlClass" ADD CONSTRAINT "UmlClass_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "UmlModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmlAttribute" ADD CONSTRAINT "UmlAttribute_classId_fkey" FOREIGN KEY ("classId") REFERENCES "UmlClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmlRelationship" ADD CONSTRAINT "UmlRelationship_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "UmlModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmlRelationship" ADD CONSTRAINT "UmlRelationship_sourceClassId_fkey" FOREIGN KEY ("sourceClassId") REFERENCES "UmlClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmlRelationship" ADD CONSTRAINT "UmlRelationship_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "UmlClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditHistory" ADD CONSTRAINT "EditHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditHistory" ADD CONSTRAINT "EditHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
