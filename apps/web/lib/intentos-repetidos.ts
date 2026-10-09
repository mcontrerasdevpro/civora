import { query } from "./db";
import {
  configuracionAlertas,
  cuerpoAlerta,
  seudonimoIntento,
  superaUmbral,
  type MotivoIntento,
} from "./alertas-fraude.mjs";
import { secretoNullifierCertificado } from "./nullifier-certificado.mjs";
import { registrarAviso, registrarError } from "./registro.mjs";

/**
 * Intentos repetidos de votar (voto ya emitido o vía no permitida) y alertas
 * de fraude. Se cuentan por propuesta, seudónimo y motivo dentro de una
 * ventana (ALERTA_FRAUDE_VENTANA_HORAS, 24); al llegar a
 * ALERTA_FRAUDE_UMBRAL (3) se registra un aviso y, si está definido, se
 * avisa a ALERTA_FRAUDE_WEBHOOK_URL (solo https) una sola vez por ventana.
 *
 * Nunca se guarda ni se envía la opción, el NIF, el nullifier ni la IP. Un
 * fallo aquí no impide ni cambia la respuesta del voto: solo se registra.
 */

let esquemaListo: Promise<void> | null = null;

function asegurarEsquemaIntentos(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = query(`
      CREATE TABLE IF NOT EXISTS intentos_repetidos (
        propuesta_id TEXT NOT NULL,
        seudonimo TEXT NOT NULL,
        motivo TEXT NOT NULL,
        via TEXT NOT NULL,
        intentos INTEGER NOT NULL,
        primera TIMESTAMPTZ NOT NULL,
        ultima TIMESTAMPTZ NOT NULL,
        alertado_en TIMESTAMPTZ,
        PRIMARY KEY (propuesta_id, seudonimo, motivo)
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

function seudonimo(propuestaId: string, via: string, nullifier: string | null): string {
  return seudonimoIntento(nullifier ? secretoNullifierCertificado(process.env) : "", propuestaId, via, nullifier);
}

/**
 * ¿Ha superado ya el umbral dentro de la ventana? La ruta responde 429 sin
 * llegar al contrato.
 */
export async function intentosBloqueados(propuestaId: string, via: string, nullifier: string): Promise<boolean> {
  const { umbral, ventanaHoras } = configuracionAlertas(process.env);
  try {
    await asegurarEsquemaIntentos();
    const filas = await query<{ intentos: number }>(
      `SELECT intentos FROM intentos_repetidos
       WHERE propuesta_id = $1 AND seudonimo = $2 AND motivo = 'voto-repetido'
         AND primera >= now() - make_interval(hours => $3)`,
      [propuestaId, seudonimo(propuestaId, via, nullifier), ventanaHoras]
    );
    return filas.length > 0 && superaUmbral(filas[0].intentos, umbral);
  } catch (error) {
    registrarError("intentos repetidos no consultados", error);
    return false;
  }
}

/** Apunta un intento rechazado y, al llegar al umbral, lanza la alerta. */
export async function registrarIntentoRepetido(datos: {
  propuestaId: string;
  via: "certificado" | "zk";
  motivo: MotivoIntento;
  nullifier: string | null;
}): Promise<void> {
  const conf = configuracionAlertas(process.env);
  try {
    await asegurarEsquemaIntentos();
    const id = seudonimo(datos.propuestaId, datos.via, datos.nullifier);
    // Atómico: fuera de la ventana, el contador vuelve a empezar.
    const [fila] = await query<{ intentos: number }>(
      `INSERT INTO intentos_repetidos (propuesta_id, seudonimo, motivo, via, intentos, primera, ultima)
       VALUES ($1, $2, $3, $4, 1, now(), now())
       ON CONFLICT (propuesta_id, seudonimo, motivo) DO UPDATE SET
         intentos = CASE WHEN intentos_repetidos.primera < now() - make_interval(hours => $5)
                         THEN 1 ELSE intentos_repetidos.intentos + 1 END,
         alertado_en = CASE WHEN intentos_repetidos.primera < now() - make_interval(hours => $5)
                            THEN NULL ELSE intentos_repetidos.alertado_en END,
         primera = CASE WHEN intentos_repetidos.primera < now() - make_interval(hours => $5)
                        THEN now() ELSE intentos_repetidos.primera END,
         ultima = now()
       RETURNING intentos`,
      [datos.propuestaId, id, datos.motivo, datos.via, conf.ventanaHoras]
    );
    if (!fila || !superaUmbral(fila.intentos, conf.umbral)) return;

    // Una sola alerta por ventana, aunque haya varias instancias.
    const marcadas = await query(
      `UPDATE intentos_repetidos SET alertado_en = now()
       WHERE propuesta_id = $1 AND seudonimo = $2 AND motivo = $3 AND alertado_en IS NULL
       RETURNING 1`,
      [datos.propuestaId, id, datos.motivo]
    );
    if (marcadas.length === 0) return;

    registrarAviso("alerta de fraude", `${datos.motivo} por ${datos.via}: ${fila.intentos} intentos`);
    if (conf.webhook) {
      await enviarAlerta(
        conf.webhook,
        conf.token,
        cuerpoAlerta({
          propuestaId: datos.propuestaId,
          via: datos.via,
          motivo: datos.motivo,
          intentos: fila.intentos,
          ventanaHoras: conf.ventanaHoras,
          seudonimo: id,
        })
      );
    }
  } catch (error) {
    registrarError("intento repetido no registrado", error);
  }
}

async function enviarAlerta(url: string, token: string | null, cuerpo: object): Promise<void> {
  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(5000),
    });
    if (!respuesta.ok) registrarAviso("alerta de fraude no entregada", `HTTP ${respuesta.status}`);
  } catch (error) {
    registrarError("alerta de fraude no entregada", error);
  }
}
