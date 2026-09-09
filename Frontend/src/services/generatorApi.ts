import { api } from './api';

export interface GeneratedBackendDownload {
  blob: Blob;
  filename: string;
  packageName: string;
  databaseName: string;
  port: number;
  dbHost: string;
  dbPort: number;
}

function filenameFromContentDisposition(value: string | undefined): string {
  const match = value?.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? 'backend.zip';
}

// El backend generado ya no se queda en el servidor (a pedido del
// usuario): esta llamada trae directamente el .zip como blob, mas los
// metadatos utiles (paquete, base de datos, puerto) en headers.
export async function generateBackend(projectId: string): Promise<GeneratedBackendDownload> {
  const res = await api.post(`/projects/${projectId}/generate-backend`, undefined, { responseType: 'blob' });
  return {
    blob: res.data,
    filename: filenameFromContentDisposition(res.headers['content-disposition']),
    packageName: res.headers['x-generated-package'],
    databaseName: res.headers['x-generated-database'],
    port: Number(res.headers['x-generated-port']),
    dbHost: res.headers['x-generated-db-host'],
    dbPort: Number(res.headers['x-generated-db-port']),
  };
}

// Ante un error (ej. modelo invalido), el backend responde JSON normal en
// vez de un zip; como pedimos responseType "blob", axios igual entrega ese
// JSON como Blob dentro de err.response.data. Esto lo vuelve a parsear.
export async function parseErrorBlob(data: unknown): Promise<{ error?: string; issues?: unknown[] } | null> {
  if (!(data instanceof Blob)) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}
