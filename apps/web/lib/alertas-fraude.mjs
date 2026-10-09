import { createHmac } from "node:crypto";
import { enteroDeEntorno } from "./recuento-eventos.mjs";

/**
 * Lógica pura de las alertas de fraude: intentos repetidos de votar en una
 * propuesta (voto ya emitido o vía no permitida). La persistencia y el envío
 * están en lib/intentos-repetidos.ts.
 *
 * Una alerta nunca lleva la opción, el NIF, el nullifier ni la IP.
 */

export const MOTIVOS = /** @type {const} */ (["voto-repetido", "via-no-permitida"]);

/**
 * Seudónimo de quien repite. Con nullifier (vía de certificado), un HMAC con
 * una clave derivada del secreto del nullifier: distinto del nullifier
 * publicado en la cadena, así que la alerta no permite buscar el voto ni su
 * opción. Sin nullifier (vía ZK, cuyo identificador no ve el servidor si el
 * contrato rechaza el voto, o vía no permitida), los intentos se agregan por
 * propuesta y vía.
 *
 * @param {string} secretoNullifier NULLIFIER_CERTIFICADO_SECRET
 * @param {string} propuestaId
 * @param {string} via
 * @param {string | null} nullifier
 * @returns {string}
 */
export function seudonimoIntento(secretoNullifier, propuestaId, via, nullifier) {
  if (!nullifier) return `${via}:agregado`;
  const clave = createHmac("sha256", secretoNullifier).update("civora-alertas-fraude").digest();
  return createHmac("sha256", clave).update(`${propuestaId}:${via}:${nullifier}`).digest("hex").slice(0, 32);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ umbral: number, ventanaHoras: number, webhook: string | null, token: string | null }}
 */
export function configuracionAlertas(env) {
  const url = env.ALERTA_FRAUDE_WEBHOOK_URL;
  let webhook = null;
  if (url) {
    try {
      webhook = new URL(url).protocol === "https:" ? url : null;
    } catch {
      webhook = null;
    }
  }
  return {
    umbral: enteroDeEntorno(env.ALERTA_FRAUDE_UMBRAL, 2) ?? 3,
    ventanaHoras: enteroDeEntorno(env.ALERTA_FRAUDE_VENTANA_HORAS, 1) ?? 24,
    webhook,
    token: env.ALERTA_FRAUDE_WEBHOOK_TOKEN || null,
  };
}

/**
 * @param {number} intentos intentos dentro de la ventana
 * @param {number} umbral
 */
export function superaUmbral(intentos, umbral) {
  return intentos >= umbral;
}

/**
 * Cuerpo de la alerta: solo estos campos, construidos en el código.
 *
 * @param {{ propuestaId: string, via: string, motivo: string, intentos: number, ventanaHoras: number, seudonimo: string }} datos
 */
export function cuerpoAlerta({ propuestaId, via, motivo, intentos, ventanaHoras, seudonimo }) {
  return {
    tipo: "civora-alerta-fraude",
    motivo,
    propuestaId,
    via,
    intentos,
    ventanaHoras,
    seudonimo,
  };
}
