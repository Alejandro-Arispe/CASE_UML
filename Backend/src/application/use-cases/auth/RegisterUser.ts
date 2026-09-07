import { createUser, User } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { PasswordHasher } from '../../../ports/out/PasswordHasher';
import { UserRepository } from '../../../ports/out/UserRepository';
import { ConflictError } from '../../errors';

const MIN_PASSWORD_LENGTH = 8;

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: { name: string; email: string; password: string }): Promise<User> {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new DomainError(`La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('Ya existe una cuenta con ese correo');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = createUser({ name: input.name, email, passwordHash });
    await this.users.save(user);
    return user;
  }
}
