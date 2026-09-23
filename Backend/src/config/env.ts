import { config } from 'dotenv';

config();

// Punto único de lectura de variables de entorno. El resto del código
// nunca debe leer process.env directamente, para mantener el dominio
// desacoplado de la configuración del proceso.
const nodeEnv = process.env.NODE_ENV ?? 'development';

// En produccion no se arranca con un secreto de JWT por defecto: cualquiera
// que lo conozca podria firmar tokens validos.
if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en produccion');
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  localWhisperUrl: process.env.LOCAL_WHISPER_URL ?? 'http://127.0.0.1:8083',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // En desarrollo, al generar un backend se crea su base "gen_..." en este
  // mismo Postgres para poder correrlo al toque con Maven. En un servidor
  // se desactiva: el zip ya trae su propia base (docker-compose) y no tiene
  // sentido acumular bases huerfanas ni exponer el host interno de la base.
  generatorCreateDatabases: process.env.GENERATOR_CREATE_DATABASES !== 'false',
};
