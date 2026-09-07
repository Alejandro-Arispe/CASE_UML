import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { login } from '../services/authApi';
import { useAuthStore } from '../store/authStore';

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
    <div>
      <h1>Iniciar sesion</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password">Contrasena</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <p>
        No tenes cuenta? <Link to="/register">Crear cuenta</Link>
      </p>
    </div>
  );
}
