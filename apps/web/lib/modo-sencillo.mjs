/**
 * Lógica pura del modo sencillo y de la accesibilidad del flujo de voto.
 * Sin dependencias del navegador para poder probarla con `node --test`:
 * quien llama pasa el almacenamiento o las voces disponibles.
 */

export const CLAVE_MODO_SENCILLO = "civora:modo-sencillo";

/**
 * Lee la preferencia guardada. `obtenerAlmacen` es una función porque el
 * mero acceso a `window.localStorage` puede lanzar (ventana privada,
 * datos del sitio bloqueados).
 *
 * @param {() => Pick<Storage, "getItem"> | null | undefined} obtenerAlmacen
 * @returns {boolean}
 */
export function leerModoSencillo(obtenerAlmacen) {
  try {
    return obtenerAlmacen()?.getItem(CLAVE_MODO_SENCILLO) === "1";
  } catch {
    return false;
  }
}

/**
 * Guarda la preferencia. Devuelve false si no se ha podido guardar; el modo
 * sigue funcionando en la sesión actual aunque no se recuerde.
 *
 * @param {() => Pick<Storage, "setItem" | "removeItem"> | null | undefined} obtenerAlmacen
 * @param {boolean} activo
 * @returns {boolean}
 */
export function guardarModoSencillo(obtenerAlmacen, activo) {
  try {
    const almacen = obtenerAlmacen();
    if (!almacen) return false;
    if (activo) almacen.setItem(CLAVE_MODO_SENCILLO, "1");
    else almacen.removeItem(CLAVE_MODO_SENCILLO);
    return true;
  } catch {
    return false;
  }
}

/**
 * Elige una voz española que se ejecute en el propio dispositivo. Las voces
 * en red (`localService === false`, como las voces «Google» de Chrome)
 * envían el texto a servidores externos y se descartan siempre.
 *
 * @template {{ lang: string; localService: boolean }} V
 * @param {readonly V[]} voces
 * @returns {V | null}
 */
export function elegirVozLocal(voces) {
  const locales = voces.filter((voz) => voz.localService === true);
  const idioma = (voz) => voz.lang.replace("_", "-").toLowerCase();
  return (
    locales.find((voz) => idioma(voz) === "es-es") ??
    locales.find((voz) => idioma(voz).startsWith("es")) ??
    null
  );
}

const JERGA = /\b(nullifiers?|pruebas?|blockchain|hash(es)?|on-chain|contratos?|relayer|criptogr\w*)\b/i;

/**
 * @param {string} texto
 * @returns {boolean}
 */
export function contieneJerga(texto) {
  return JERGA.test(texto);
}

/**
 * Mensaje de error apto para el votante: en modo sencillo, los mensajes
 * técnicos se sustituyen por uno genérico.
 *
 * @param {string} mensaje
 * @param {boolean} sencillo
 * @param {string} generico
 * @returns {string}
 */
export function mensajeParaVotante(mensaje, sencillo, generico) {
  return sencillo && contieneJerga(mensaje) ? generico : mensaje;
}

/**
 * Texto exacto con el que el servidor rechaza un reto de certificado
 * caducado (lib/certificado-digital.ts). Un test comprueba que no diverge.
 */
export const MENSAJE_RETO_CADUCADO = "El reto ha caducado o no es válido.";

/**
 * @param {string | null | undefined} mensaje
 * @returns {boolean}
 */
export function esRetoCaducado(mensaje) {
  return mensaje === MENSAJE_RETO_CADUCADO;
}

/**
 * Audios pregrabados de confirmación, servidos desde nuestro propio origen.
 * La opción elegida nunca pasa por `speechSynthesis`. Son provisionales
 * (voz local del sistema); en producción se sustituirán por grabaciones
 * profesionales.
 */
export const AUDIO_CONFIRMACION = Object.freeze({
  a_favor: "/audio/confirmacion/a_favor.wav",
  en_contra: "/audio/confirmacion/en_contra.wav",
  abstencion: "/audio/confirmacion/abstencion.wav",
});
