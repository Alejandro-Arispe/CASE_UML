import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../ports/out/PasswordHasher';

const SALT_ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
