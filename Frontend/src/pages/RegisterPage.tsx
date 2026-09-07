import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { login, register } from '../services/authApi';
import { useAuthStore } from '../store/authStore';

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
    <div>
      <h1>Crear cuenta</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Nombre</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password">Contrasena</label>
          <input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Creando...' : 'Crear cuenta'}
        </button>
      </form>
      <p>
        Ya tenes cuenta? <Link to="/login">Iniciar sesion</Link>
      </p>
    </div>
  );
}
