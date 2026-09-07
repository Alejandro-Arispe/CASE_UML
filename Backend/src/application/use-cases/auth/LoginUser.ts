import { User } from '../../../domain/entities';
import { PasswordHasher } from '../../../ports/out/PasswordHasher';
import { TokenService } from '../../../ports/out/TokenService';
import { UserRepository } from '../../../ports/out/UserRepository';
import { UnauthorizedError } from '../../errors';

export class LoginUser {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const user = await this.users.findByEmail(input.email.trim().toLowerCase());
    // Mismo mensaje para usuario inexistente y contrasena incorrecta: evita
    // que la respuesta permita enumerar correos registrados.
    if (!user) {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const valid = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const token = this.tokenService.sign({ userId: user.id });
    return { token, user };
  }
}
