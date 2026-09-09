import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { login, register } from '../services/authApi';
import { useAuthStore } from '../store/authStore';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';

export function RegisterPage() {
  const navigate = useNavigate();
  const setLogin = useAuthStore((state) => state.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ name, email, password });
      // Tras registrarse, inicia sesion automaticamente para no pedir los
      // mismos datos dos veces.
      const { token, user } = await login({ email, password });
      setLogin(token, user);
      navigate('/projects');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setError(message ?? 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Empeza a modelar tus proyectos en minutos."
      footer={
        <>
          Ya tenes cuenta?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Iniciar sesion
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full"
          />
        </div>
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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full"
          />
          <p className="mt-1 text-xs text-slate-400">Minimo 8 caracteres.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? 'Creando...' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthLayout>
  );
}
