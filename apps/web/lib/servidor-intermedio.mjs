/**
 * Servidor intermedio de Autofirma para móviles (ADR 0024).
 *
 * En Android e iOS, `public/js/autoscript.js` no habla con Autofirma de
 * escritorio: abre la app Cliente @firma móvil con `afirma://` y se
 * comunica con ella a través de dos servicios del mismo origen:
 *
 * - `/afirma-signature-storage/StorageService`: guarda datos (`op=put`).
 * - `/afirma-signature-retriever/RetrieveService`: los devuelve una sola
 *   vez (`op=get`) y responde `ERR-06` mientras no existan.
 *
 * Los dos responden a `op=check` para que el script compruebe que existen.
 * Los datos llegan cifrados con una clave que viaja solo en el enlace
 * `afirma://` (AES-256 o DES heredado), así que el servidor no puede leerlos.
 *
 * Este módulo contiene la lógica pura (validación y respuestas) para
 * probarla con `node --test`; el almacenamiento está en
 * `servidor-intermedio-store.ts`.
 */

/** Versión de la sintaxis del protocolo que usa autoscript.js 1.10.1. */
export const VERSION_SINTAXIS = "1_0";

/** Minutos que se guarda un dato antes de caducar. */
export const MINUTOS_CADUCIDAD = 5;

/**
 * Tamaño máximo del cuerpo y de `dat`. Una firma CAdES con su cadena ocupa
 * unos pocos KB; se deja margen para certificados grandes.
 */
export const BYTES_MAXIMOS = 256 * 1024;

/** Tope de datos pendientes a la vez, para que no sirva de almacén ajeno. */
export const MAXIMO_PENDIENTES = 2000;

/**
 * Identificadores de autoscript.js: 20 caracteres de `VALID_CHARS_TO_ID`.
 * Se admite un rango algo mayor por compatibilidad con otras versiones.
 */
const ID_VALIDO = /^[0-9A-Za-z]{8,64}$/;

/**
 * Respuestas del protocolo, en texto plano y siempre con estado 200: el
 * script solo lee el texto si el estado es 200 y sigue esperando mientras
 * recibe `ERR-06`, como con los servlets originales.
 */
export const RESPUESTAS = Object.freeze({
  ok: "OK",
  sinOperacion: "ERR-01:= No se ha indicado la operacion a realizar",
  sinParametros: "ERR-02:= No se han indicado todos los parametros necesarios",
  version: "ERR-03:= La version de la sintaxis no esta soportada",
  operacion: "ERR-04:= Operacion no soportada",
  demasiadoGrande: "ERR-05:= Los datos superan el tamano maximo permitido",
  noExiste: "ERR-06:= El documento no existe en el servidor",
  lleno: "ERR-07:= El servidor no admite mas datos en este momento",
  interno: "ERR-08:= Error interno del servidor",
});

/**
 * @typedef {{ tipo: "check" }
 *   | { tipo: "put", id: string, datos: string }
 *   | { tipo: "get", id: string }
 *   | { tipo: "error", respuesta: string }} Peticion
 */

/**
 * Interpreta los parámetros de una petición a uno de los dos servicios.
 *
 * @param {URLSearchParams} parametros parámetros de la URL y del cuerpo
 * @param {"almacen" | "recuperacion"} servicio
 * @returns {Peticion}
 */
export function interpretarPeticion(parametros, servicio) {
  const op = parametros.get("op");
  if (!op) return { tipo: "error", respuesta: RESPUESTAS.sinOperacion };
  if (op === "check") return { tipo: "check" };

  const operacionEsperada = servicio === "almacen" ? "put" : "get";
  if (op !== operacionEsperada) return { tipo: "error", respuesta: RESPUESTAS.operacion };

  const version = parametros.get("v");
  const id = parametros.get("id");
  if (!version || !id) return { tipo: "error", respuesta: RESPUESTAS.sinParametros };
  if (version !== VERSION_SINTAXIS) return { tipo: "error", respuesta: RESPUESTAS.version };
  if (!ID_VALIDO.test(id)) return { tipo: "error", respuesta: RESPUESTAS.sinParametros };

  if (servicio === "recuperacion") return { tipo: "get", id };

  const datos = parametros.get("dat");
  if (!datos) return { tipo: "error", respuesta: RESPUESTAS.sinParametros };
  if (Buffer.byteLength(datos, "utf8") > BYTES_MAXIMOS) {
    return { tipo: "error", respuesta: RESPUESTAS.demasiadoGrande };
  }
  return { tipo: "put", id, datos };
}

/**
 * Une los parámetros de la URL y del cuerpo (`application/x-www-form-urlencoded`).
 * Los del cuerpo prevalecen, como en los servlets originales con POST.
 *
 * @param {string} url
 * @param {string} cuerpo
 * @returns {URLSearchParams}
 */
export function unirParametros(url, cuerpo) {
  const parametros = new URLSearchParams(new URL(url).search);
  for (const [clave, valor] of new URLSearchParams(cuerpo)) parametros.set(clave, valor);
  return parametros;
}

/**
 * Fecha de caducidad de un dato guardado ahora.
 *
 * @param {Date} [ahora]
 * @returns {Date}
 */
export function caducidad(ahora = new Date()) {
  return new Date(ahora.getTime() + MINUTOS_CADUCIDAD * 60_000);
}
