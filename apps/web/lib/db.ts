import { Pool, type QueryResultRow } from "pg";

/**
 * Conexion a Postgres. En la demo es el servicio civora-db del VPS, con
 * ?sslmode=disable en la URL (red interna; ver ADR 0013); en local, Neon u
 * otro Postgres con TLS. El sslmode de la URL prevalece sobre `ssl`.
 *
 * DATABASE_URL no se versiona (ver README): en local se define en
 * apps/web/.env.local y en el VPS en las variables del servicio.
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
    `)
      // Contrato con el que se creó cada propuesta: al cambiar de contrato,
      // las anteriores dejan de listarse y de admitir votos.
      .then(() => query("ALTER TABLE propuestas ADD COLUMN IF NOT EXISTS contrato TEXT"))
      .then(() => undefined);
  }
  return esquemaListo;
}
