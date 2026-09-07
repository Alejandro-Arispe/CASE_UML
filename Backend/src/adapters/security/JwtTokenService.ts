import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { TokenPayload, TokenService } from '../../ports/out/TokenService';

export class JwtTokenService implements TokenService {
  sign(payload: TokenPayload): string {
    return jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verify(token: string): TokenPayload {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === 'string' || !('userId' in decoded)) {
      throw new Error('Token con formato invalido');
    }
    return { userId: (decoded as jwt.JwtPayload & TokenPayload).userId };
  }
}
