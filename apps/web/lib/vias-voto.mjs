/**
 * Vías de identidad con las que se admite votar (hallazgo A-04).
 *
 * Nada en la cadena relaciona el nullifier de certificado (HMAC del DNI) con
 * el identificador de ZKPassport (que además es por documento, no por
 * persona): con las dos vías abiertas, una persona puede votar dos veces.
 * Con una sola vía no hay voto cruzado. Por defecto, solo certificado: el
 * DNIe y el certificado de la FNMT dan el mismo NIF y, por tanto, el mismo
 * nullifier.
 *
 * VIAS_HABILITADAS: "certificado" (por defecto), "zk" o "certificado,zk".
 * Un valor desconocido no abre nada: se vuelve al valor por defecto.
 */

export const VIAS = /** @type {const} */ (["certificado", "zk"]);
export const VIAS_POR_DEFECTO = /** @type {const} */ (["certificado"]);

/**
 * @param {string | undefined} valor
 * @returns {("certificado" | "zk")[]}
 */
export function viasHabilitadas(valor) {
  if (!valor || !valor.trim()) return [...VIAS_POR_DEFECTO];
  const piezas = valor.split(",").map((pieza) => pieza.trim().toLowerCase());
  if (piezas.some((pieza) => !VIAS.includes(/** @type {never} */ (pieza)))) return [...VIAS_POR_DEFECTO];
  return VIAS.filter((via) => piezas.includes(via));
}

/**
 * @param {readonly string[]} vias
 * @param {string} via
 */
export function viaPermitida(vias, via) {
  return vias.includes(via);
}

/**
 * Con más de una vía, una persona puede votar una vez por cada una.
 * @param {readonly string[]} vias
 */
export function permiteVotoCruzado(vias) {
  return vias.length > 1;
}
