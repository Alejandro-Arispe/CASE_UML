import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { login } from '../services/authApi';
import { useAuthStore } from '../store/authStore';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const setLogin = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await login({ email, password });
      setLogin(token, user);
      navigate('/projects');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setError(message ?? 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesion"
      subtitle="Entra a tus proyectos de modelado UML."
      footer={
        <>
          No tenes cuenta?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-700">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
          />
        </div>
        <div>
          <Label htmlFor="password">Contrasena</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
