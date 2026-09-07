// Error para violaciones de invariantes del dominio (ej. nombre vacio,
// tipo invalido). Los casos de uso lo capturan para traducirlo a una
// respuesta HTTP/Socket apropiada; el dominio no conoce esos protocolos.
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
