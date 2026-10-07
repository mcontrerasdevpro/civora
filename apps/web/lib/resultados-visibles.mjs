export function resultadosVisibles(fechaCierre, ahora = Date.now()) {
  const cierre = Date.parse(fechaCierre);
  return Number.isFinite(cierre) && ahora >= cierre;
}