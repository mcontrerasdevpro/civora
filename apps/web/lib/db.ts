import { Pool, type QueryResultRow } from "pg";

/**
 * Conexion a Postgres (pensada para Neon, pero cualquier Postgres vale: no
 * se usa nada especifico del proveedor mas alla de exigir TLS).
 *
 * DATABASE_URL no se versiona (ver README): en local se define en
 * apps/web/.env.local, en Vercel en las variables de entorno del proyecto.
 * Usa la cadena de conexion "pooled" que da Neon si vas a desplegar en
 * serverless (Vercel), para no agotar las conexiones directas a Postgres.
 */
let pool: Pool | undefined;

function obtenerPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Falta DATABASE_URL: define la cadena de conexion de tu base de datos Neon (ver README)."
      );
    }
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  texto: string,
  valores?: unknown[]
): Promise<T[]> {
  const resultado = await obtenerPool().query<T>(texto, valores);
  return resultado.rows;
}

let esquemaListo: Promise<void> | null = null;

/**
 * Crea la tabla de propuestas si no existe todavia. Se llama antes de cada
 * operacion de lectura/escritura sobre ella: no requiere una migracion
 * manual para levantar una base de datos Neon nueva.
 */
export function asegurarEsquema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = query(`
      CREATE TABLE IF NOT EXISTS propuestas (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        pregunta TEXT NOT NULL,
        opciones TEXT[] NOT NULL,
        fecha_apertura TIMESTAMPTZ NOT NULL,
        fecha_cierre TIMESTAMPTZ NOT NULL,
        elegibilidad JSONB NOT NULL,
        contenido_hash TEXT NOT NULL,
        tx_hash TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `).then(() => undefined);
  }
  return esquemaListo;
}
