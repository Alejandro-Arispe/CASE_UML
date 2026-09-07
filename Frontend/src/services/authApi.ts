import { api } from './api';
import type { AuthUser } from '../types/auth';

export function register(input: { name: string; email: string; password: string }) {
  return api.post<AuthUser>('/auth/register', input).then((res) => res.data);
}

export function login(input: { email: string; password: string }) {
  return api.post<{ token: string; user: AuthUser }>('/auth/login', input).then((res) => res.data);
}
