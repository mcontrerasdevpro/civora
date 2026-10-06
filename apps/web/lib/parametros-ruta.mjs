/**
 * Último segmento de la ruta de la petición, decodificado. Las rutas API
 * dinámicas lo leen de la URL en lugar del segundo argumento `{ params }`,
 * que en Next 15 pasa a ser una promesa: así funcionan igual en 14 y 15.
 *
 * @param {Request} request
 * @returns {string}
 */
export function segmentoFinal(request) {
  const segmentos = new URL(request.url).pathname.split("/").filter(Boolean);
  const ultimo = segmentos.at(-1) ?? "";
  try {
    return decodeURIComponent(ultimo);
  } catch {
    return ultimo;
  }
}
