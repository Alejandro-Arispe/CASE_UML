import axios from 'axios';

// Cliente HTTP unico de la app. El interceptor adjunta el JWT guardado
// tras el login; las features no deben crear sus propias instancias de axios.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
});

api.interceptors.request.use((requestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});
