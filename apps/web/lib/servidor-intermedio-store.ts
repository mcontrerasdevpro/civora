import { query } from "./db";
import {
  BYTES_MAXIMOS,
  MAXIMO_PENDIENTES,
  RESPUESTAS,
  caducidad,
  interpretarPeticion,
  unirParametros,
} from "./servidor-intermedio.mjs";
import { registrarError } from "./registro.mjs";

/**
 * Almacén del servidor intermedio de Autofirma para móviles (ADR 0024).
 * Solo guarda datos cifrados por el navegador o por la app Cliente @firma
 * móvil, con caducidad de minutos, y los borra al leerlos. No se registran
 * ni el identificador ni los datos.
 */

let esquemaListo: Promise<void> | null = null;

function asegurarEsquema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = query(`
      CREATE TABLE IF NOT EXISTS servidor_intermedio (
        id TEXT PRIMARY KEY,
        datos TEXT NOT NULL,
        caduca TIMESTAMPTZ NOT NULL
      )
    `)
      .then(() => undefined)
      .catch((error) => {
        esquemaListo = null;
        throw error;
      });
  }
  return esquemaListo;
}

/** Guarda (o sustituye) un dato; `false` si se ha llegado al tope de pendientes. */
async function guardar(id: string, datos: string): Promise<boolean> {
  await asegurarEsquema();
  await query("DELETE FROM servidor_intermedio WHERE caduca <= now()");
  const filas = await query(
    `INSERT INTO servidor_intermedio (id, datos, caduca)
       SELECT $1, $2, $3
       WHERE (SELECT count(*) FROM servidor_intermedio) < $4
          OR EXISTS (SELECT 1 FROM servidor_intermedio WHERE id = $1)
     ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, caduca = EXCLUDED.caduca
     RETURNING id`,
    [id, datos, caducidad(), MAXIMO_PENDIENTES]
  );
  return filas.length > 0;
}

/** Devuelve el dato y lo borra en la misma operación; `null` si no existe o caducó. */
async function recuperar(id: string): Promise<string | null> {
  await asegurarEsquema();
  const filas = await query<{ datos: string }>(
    "DELETE FROM servidor_intermedio WHERE id = $1 AND caduca > now() RETURNING datos",
    [id]
  );
  return filas[0]?.datos ?? null;
}

function texto(contenido: string): Response {
  return new Response(contenido, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Atiende GET y POST de StorageService (`almacen`) o RetrieveService (`recuperacion`). */
export async function atenderServidorIntermedio(
  request: Request,
  servicio: "almacen" | "recuperacion"
): Promise<Response> {
  const longitud = Number(request.headers.get("content-length") ?? "0");
  // Margen sobre `dat` para el resto de parámetros y la codificación del formulario.
  if (longitud > BYTES_MAXIMOS * 2) return texto(RESPUESTAS.demasiadoGrande);

  const cuerpo = request.method === "POST" ? await request.text().catch(() => "") : "";
  if (cuerpo.length > BYTES_MAXIMOS * 2) return texto(RESPUESTAS.demasiadoGrande);

  const peticion = interpretarPeticion(unirParametros(request.url, cuerpo), servicio);
  try {
    switch (peticion.tipo) {
      case "check":
        return texto(RESPUESTAS.ok);
      case "error":
        return texto(peticion.respuesta);
      case "put":
        return texto((await guardar(peticion.id, peticion.datos)) ? RESPUESTAS.ok : RESPUESTAS.lleno);
      case "get":
        return texto((await recuperar(peticion.id)) ?? RESPUESTAS.noExiste);
    }
  } catch (error) {
    registrarError(servicio === "almacen" ? "servidor intermedio, guardar" : "servidor intermedio, recuperar", error);
    return texto(RESPUESTAS.interno);
  }
}
