/**
 * Único punto del servidor que escribe en la consola. Nunca registra el
 * objeto de error: los errores de ethers incluyen la petición RPC o la
 * transacción (nullifier, opción, datos de la llamada) y los de Node pueden
 * incluir cuerpos o cabeceras. Solo se registra un contexto fijo y un
 * código corto. Tampoco se registran IPs, cuerpos, firmas ni certificados.
 */

const CODIGO_SEGURO = /^[A-Z][A-Z0-9_]{1,63}$/;
const NOMBRE_SEGURO = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

/**
 * Código corto y sin datos que describe un error.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function codigoDeError(error) {
  if (error && typeof error === "object") {
    const { code, name } = /** @type {{ code?: unknown, name?: unknown }} */ (error);
    if (typeof code === "string" && CODIGO_SEGURO.test(code)) return code;
    if (typeof name === "string" && NOMBRE_SEGURO.test(name)) return name;
  }
  return "ERROR_DESCONOCIDO";
}

/**
 * @param {string} contexto texto fijo escrito en el código, nunca datos de la petición
 * @param {unknown} error
 */
export function registrarError(contexto, error) {
  console.error(`[civora] ${contexto}: ${codigoDeError(error)}`);
}

/**
 * @param {string} contexto texto fijo escrito en el código
 * @param {string} detalle texto construido en el código, sin datos del votante
 */
export function registrarAviso(contexto, detalle) {
  console.warn(`[civora] ${contexto}: ${detalle}`);
}
