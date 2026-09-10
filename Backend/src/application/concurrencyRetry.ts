// Compartido por los dos casos de uso que escriben UmlModel con control de
// concurrencia optimista (ApplyUmlOperation y SaveUmlModel): si el guardado
// choca porque otro cliente ya avanzo la revision, hay que reintentar en vez
// de pisar el cambio ajeno o descartar el propio.
export const MAX_CONCURRENCY_RETRIES = 8;

// Backoff aleatorio y creciente entre reintentos: sin esto, varios clientes
// que perdieron la carrera al mismo tiempo (ej. 10 usuarios guardando en el
// mismo instante) reintentarian todos de nuevo en el mismo instante y
// volverian a chocar entre si en cascada.
export function concurrencyBackoff(attempt: number): Promise<void> {
  const delayMs = Math.floor(Math.random() * 20 * (attempt + 1));
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
