import { Client } from 'pg';
import { env } from '../config/env';

// CREATE DATABASE no se puede ejecutar dentro de una transaccion ni tiene
// una forma nativa "IF NOT EXISTS" en PostgreSQL: hay que verificar primero
// contra pg_database. Se conecta con las mismas credenciales de la
// plataforma (mismo servidor Postgres, otra base) para no requerir un
// segundo contenedor solo para las bases generadas.
export async function ensureDatabaseExists(databaseName: string): Promise<void> {
  const url = new URL(env.databaseUrl);
  const client = new Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: url.username,
    password: url.password,
    database: 'postgres',
  });

  await client.connect();
  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (result.rowCount === 0) {
      // El nombre de la base ya salio de shortProjectId (hex, sin
      // caracteres especiales): seguro de interpolar directamente, ya que
      // CREATE DATABASE no admite parametros preparados para el nombre.
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }
}
