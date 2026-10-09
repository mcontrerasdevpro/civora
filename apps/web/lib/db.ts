import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Conexion a Postgres. En la demo es el servicio civora-db del VPS, con
 * ?sslmode=disable en la URL (red interna; ver ADR 0013); en local, cualquier
 * Postgres. El sslmode de la URL prevalece sobre `ssl`.
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
        "Falta DATABASE_URL: define la cadena de conexion de tu base de datos Postgres (ver README)."
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

/**
 * Ejecuta `fn` dentro de una transacción: si lanza, se deshace todo.
 */
export async function enTransaccion<T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await fn(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

let esquemaEventosListo: Promise<void> | null = null;

/**
 * Tablas del índice de eventos (ver ADR 0020): copia de los eventos públicos
 * VotoEmitido del contrato y último bloque procesado por contrato. Son una
 * caché de la cadena: se pueden borrar y se reconstruyen solas.
 */
export function asegurarEsquemaEventos(): Promise<void> {
  if (!esquemaEventosListo) {
    esquemaEventosListo = query(`
      CREATE TABLE IF NOT EXISTS eventos_voto (
        contrato TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        indice_log INTEGER NOT NULL,
        bloque BIGINT NOT NULL,
        propuesta_id TEXT NOT NULL,
        nullifier TEXT NOT NULL,
        opcion SMALLINT NOT NULL,
        selector TEXT,
        PRIMARY KEY (contrato, tx_hash, indice_log)
      )
    `)
      .then(() => query("CREATE INDEX IF NOT EXISTS eventos_voto_propuesta ON eventos_voto (contrato, propuesta_id)"))
      .then(() =>
        query(`
          CREATE TABLE IF NOT EXISTS indice_eventos (
            contrato TEXT PRIMARY KEY,
            ultimo_bloque BIGINT NOT NULL,
            ultimo_timestamp BIGINT NOT NULL DEFAULT 0,
            actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `)
      )
      .then(() => undefined)
      .catch((error) => {
        esquemaEventosListo = null;
        throw error;
      });
  }
  return esquemaEventosListo;
}

let esquemaListo: Promise<void> | null = null;

/**
 * Crea la tabla de propuestas si no existe todavia. Se llama antes de cada
 * operacion de lectura/escritura sobre ella: no requiere una migracion
 * manual para levantar una base de datos nueva.
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
      // Vía fijada en el contrato al crearla (ADR 0021); null en las anteriores.
      .then(() => query("ALTER TABLE propuestas ADD COLUMN IF NOT EXISTS via TEXT"))
      .then(() => undefined);
  }
  return esquemaListo;
}
