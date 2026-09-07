export {};

// userId se llena desde el JWT verificado (ver requireAuth). Nunca debe
// leerse de req.body ni de un header/campo enviado directamente por el cliente.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
