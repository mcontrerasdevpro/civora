/**
 * Recuento de una propuesta a partir de los eventos públicos `VotoEmitido`
 * del contrato, y vía de cada voto según la función que lo registró. Lógica
 * pura: quien llama lee la cadena y pasa los datos, para probarla con
 * `node --test`.
 */

export const FIRMA_VOTO_EMITIDO = "VotoEmitido(bytes32,bytes32,uint8)";

/**
 * @typedef {{ opcion: number; nullifier: string; selector: string | null }} EventoVoto
 * @typedef {{ certificado: string; zk: string }} SelectoresVia
 */

/**
 * Vía de un voto según el selector (4 bytes) de la transacción que lo
 * emitió: `votarManual` es la vía de certificado y `votarConPruebaZk`, la de
 * DNIe o pasaporte. Cualquier otro (o desconocido) cuenta como «otra».
 *
 * @param {string | null} selector
 * @param {SelectoresVia} selectores
 * @returns {"certificado" | "zk" | "otra"}
 */
export function viaDeSelector(selector, selectores) {
  const s = selector?.toLowerCase();
  if (s && s === selectores.certificado.toLowerCase()) return "certificado";
  if (s && s === selectores.zk.toLowerCase()) return "zk";
  return "otra";
}

/**
 * Cuenta los votos de los eventos. Un nullifier repetido no debería existir
 * (el contrato lo impide); si aparece, se informa en `duplicados` y solo
 * cuenta el primero, como haría el contrato.
 *
 * @param {readonly EventoVoto[]} eventos
 * @param {SelectoresVia | null} selectores null si no se pudo leer la vía
 */
export function recontarEventos(eventos, selectores) {
  const recuento = { aFavor: 0, enContra: 0, abstenciones: 0 };
  const porVia = selectores ? { certificado: 0, zk: 0, otra: 0 } : null;
  const vistos = new Set();
  let duplicados = 0;

  for (const evento of eventos) {
    const nullifier = evento.nullifier.toLowerCase();
    if (vistos.has(nullifier)) {
      duplicados += 1;
      continue;
    }
    vistos.add(nullifier);
    if (evento.opcion === 0) recuento.aFavor += 1;
    else if (evento.opcion === 1) recuento.enContra += 1;
    else if (evento.opcion === 2) recuento.abstenciones += 1;
    else throw new RangeError(`Opción desconocida en un evento: ${evento.opcion}`);
    if (porVia) porVia[viaDeSelector(evento.selector, selectores)] += 1;
  }

  return { ...recuento, total: vistos.size, porVia, duplicados };
}

/**
 * ¿Coincide el recuento de los eventos con el que guarda el contrato?
 *
 * @param {{ aFavor: number; enContra: number; abstenciones: number }} a
 * @param {{ aFavor: number; enContra: number; abstenciones: number }} b
 */
export function mismoRecuento(a, b) {
  return a.aFavor === b.aFavor && a.enContra === b.enContra && a.abstenciones === b.abstenciones;
}

/**
 * Primer bloque cuyo timestamp es >= `objetivo` (segundos), por búsqueda
 * binaria entre `bajo` y `alto`. Si ninguno lo alcanza, devuelve `alto`.
 *
 * @param {(numero: number) => Promise<number>} timestampDe
 * @param {number} bajo
 * @param {number} alto
 * @param {number} objetivo
 */
export async function primerBloqueDesde(timestampDe, bajo, alto, objetivo) {
  return primerBloqueQueCumple(async (numero) => (await timestampDe(numero)) >= objetivo, bajo, alto);
}

/**
 * Primer bloque entre `bajo` y `alto` que cumple `cumple`, que debe ser
 * monótono (falso y luego siempre verdadero). Si ninguno lo cumple,
 * devuelve `alto`. Sirve también para hallar el bloque de despliegue del
 * contrato (el primero con código en su dirección).
 *
 * @param {(numero: number) => Promise<boolean>} cumple
 * @param {number} bajo
 * @param {number} alto
 */
export async function primerBloqueQueCumple(cumple, bajo, alto) {
  let lo = bajo;
  let hi = alto;
  while (lo < hi) {
    const medio = Math.floor((lo + hi) / 2);
    if (await cumple(medio)) hi = medio;
    else lo = medio + 1;
  }
  return lo;
}

/**
 * Rangos que procesa un ciclo del indexador: desde el bloque siguiente al
 * último procesado hasta `objetivo` (el último bloque final), troceados en
 * `tamano` bloques y como mucho `maximo` rangos por ciclo.
 *
 * @param {number} ultimoProcesado
 * @param {number} objetivo
 * @param {number} tamano
 * @param {number} maximo
 * @returns {[number, number][]}
 */
export function rangosDelCiclo(ultimoProcesado, objetivo, tamano, maximo) {
  if (objetivo <= ultimoProcesado) return [];
  const hasta = Math.min(objetivo, ultimoProcesado + tamano * maximo);
  return rangosDeBloques(ultimoProcesado + 1, hasta, tamano);
}

/**
 * Trocea [desde, hasta] en rangos de como mucho `tamano` bloques, para
 * proveedores RPC que limitan `eth_getLogs` (el plan gratuito de Alchemy
 * admite 10 bloques).
 *
 * @param {number} desde
 * @param {number} hasta
 * @param {number} tamano
 * @returns {[number, number][]}
 */
export function rangosDeBloques(desde, hasta, tamano) {
  if (!Number.isInteger(tamano) || tamano < 1) throw new RangeError("Tamaño de rango no válido");
  const rangos = [];
  for (let inicio = desde; inicio <= hasta; inicio += tamano) {
    rangos.push([inicio, Math.min(inicio + tamano - 1, hasta)]);
  }
  return rangos;
}

/**
 * Lee un entero de una variable de entorno: solo dígitos decimales, sin signo
 * y dentro de Number.MAX_SAFE_INTEGER. `Number()` aceptaría "0x…" (una
 * dirección pegada por error se convertiría en un bloque inexistente), "1e3"
 * o espacios.
 *
 * @param {string | undefined} valor
 * @param {number} minimo
 * @returns {number | null} null si falta o no es válido
 */
export function enteroDeEntorno(valor, minimo) {
  if (valor === undefined || !/^\d+$/.test(valor)) return null;
  const n = Number(valor);
  return Number.isSafeInteger(n) && n >= minimo ? n : null;
}
