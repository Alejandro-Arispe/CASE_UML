import { create } from 'zustand';
import type { AuthUser } from '../types/auth';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

// Estado de sesion global, independiente de React Flow y de las paginas.
// Se hidrata desde localStorage para sobrevivir a recargas de pagina.
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') ?? 'null'),
  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));
