import { PrismaClient } from '@prisma/client';
import { User } from '../../domain/entities';
import { UserRepository } from '../../ports/out/UserRepository';

// El modelo Prisma User coincide campo a campo con la entidad de dominio,
// por lo que no hace falta un mapper explicito.
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: user,
    });
  }
}
