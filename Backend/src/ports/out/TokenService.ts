export interface TokenPayload {
  userId: string;
}

// Abstrae la emision/verificacion de tokens de sesion: la aplicacion no
// conoce JWT ni su libreria, solo este contrato.
export interface TokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
