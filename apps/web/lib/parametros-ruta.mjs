/**
 * Último segmento de la ruta de la petición, decodificado. Las rutas API
 * dinámicas lo leen de la URL en lugar del segundo argumento `{ params }`,
 * que en Next 15 pasa a ser una promesa: así funcionan igual en 14 y 15.
 *
 * @param {Request} request
 * @returns {string}
 */
export function segmentoFinal(request) {
  return segmentoDesdeElFinal(request, 1);
}

/**
 * Segmento `posicion` contando desde el final (1 = el último), decodificado.
 * Para rutas anidadas como /api/propuestas/[id]/verificacion (posición 2).
 *
 * @param {Request} request
 * @param {number} posicion
 * @returns {string}
 */
export function segmentoDesdeElFinal(request, posicion) {
  const segmentos = new URL(request.url).pathname.split("/").filter(Boolean);
  const segmento = segmentos.at(-posicion) ?? "";
  try {
    return decodeURIComponent(segmento);
  } catch {
    return segmento;
  }
}
