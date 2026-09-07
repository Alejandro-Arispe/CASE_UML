import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// Protege rutas que requieren sesion iniciada. La validez real del token la
// sigue verificando el backend en cada request; esto solo evita mostrar
// paginas que fallarian por falta de token.
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
