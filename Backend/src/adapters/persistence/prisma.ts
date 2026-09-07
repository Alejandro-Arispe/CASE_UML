import { PrismaClient } from '@prisma/client';

// Instancia unica del cliente Prisma para todo el proceso. Los repositorios
// la reciben inyectada en vez de crear cada uno la suya.
export const prisma = new PrismaClient();
