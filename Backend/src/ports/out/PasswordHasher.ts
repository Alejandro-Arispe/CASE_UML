// Abstrae el algoritmo de hashing de contrasenas: la aplicacion depende de
// esta interfaz, no de bcrypt directamente.
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
