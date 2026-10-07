/**
 * Lógica pura para clasificar propuestas por contrato y los rechazos del
 * contrato. Sin dependencias, para probarla con `node --test`.
 */

/** Mensaje para propuestas creadas con un contrato que ya no está en uso. */
export const MENSAJE_PROPUESTA_ARCHIVADA =
  "Esta propuesta pertenece a una versión anterior de la demostración y ya no admite votos.";

/**
 * Una propuesta es del contrato actual si se creó con él. Las anteriores a
 * guardar el contrato (sin dato) se consideran vigentes.
 *
 * @param {string | null | undefined} contratoDeLaPropuesta
 * @param {string} contratoActual
 * @returns {boolean}
 */
export function esPropuestaVigente(contratoDeLaPropuesta, contratoActual) {
  if (!contratoDeLaPropuesta) return true;
  return contratoDeLaPropuesta.toLowerCase() === contratoActual.toLowerCase();
}

/**
 * Indica si ethers ha recibido un revert del contrato (la llamada se rechazó),
 * no un fallo de red o de configuración.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function esRechazoDelContrato(error) {
  return Boolean(error && typeof error === "object" && /** @type {{ code?: unknown }} */ (error).code === "CALL_EXCEPTION");
}

/**
 * Selector de 4 bytes del error con el que revierte el contrato (o el
 * verificador de ZKPassport). Identifica el tipo de error sin datos del
 * votante; se puede registrar para diagnosticar.
 *
 * @param {unknown} error
 * @returns {string | null}
 */
export function selectorDeRevert(error) {
  if (!error || typeof error !== "object") return null;
  const e = /** @type {{ data?: unknown, info?: { error?: { data?: unknown } }, error?: { data?: unknown } }} */ (error);
  const anidado = e.info?.error?.data;
  const candidatos = [
    e.data,
    anidado,
    anidado && typeof anidado === "object" ? /** @type {{ data?: unknown }} */ (anidado).data : undefined,
    e.error?.data,
  ];
  for (const candidato of candidatos) {
    if (typeof candidato === "string" && /^0x[0-9a-fA-F]{8}/.test(candidato)) return candidato.slice(0, 10).toLowerCase();
  }
  return null;
}
