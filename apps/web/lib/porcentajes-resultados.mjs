/**
 * Reparto de los votos emitidos entre las tres opciones, con porcentajes
 * redondeados a un decimal. Lógica pura, sin dependencias del navegador,
 * para probarla con `node --test`.
 *
 * Los porcentajes se calculan en décimas enteras (333 = 33,3 %) con
 * redondeo al más próximo y los empates hacia arriba, sin coma flotante:
 * así el mismo recuento da siempre el mismo texto.
 */

export const OPCIONES_RESULTADO = Object.freeze([
  { clave: "aFavor", opcion: "a_favor", etiqueta: "A favor" },
  { clave: "enContra", opcion: "en_contra", etiqueta: "En contra" },
  { clave: "abstenciones", opcion: "abstencion", etiqueta: "Abstención" },
]);

/**
 * Décimas de porcentaje de `votos` sobre `total`, redondeadas: 1 de 3 → 333.
 *
 * @param {number} votos
 * @param {number} total
 * @returns {number}
 */
export function decimasDePorcentaje(votos, total) {
  if (!Number.isInteger(votos) || !Number.isInteger(total) || votos < 0 || total <= 0 || votos > total) {
    throw new RangeError("Recuento no válido");
  }
  // round(votos * 1000 / total) en enteros: floor((2·votos·1000 + total) / (2·total)).
  return Math.floor((2 * votos * 1000 + total) / (2 * total));
}

/**
 * Texto en español de unas décimas de porcentaje: 333 → «33,3 %».
 *
 * @param {number} decimas
 * @returns {string}
 */
export function formatearPorcentaje(decimas) {
  const enteros = Math.floor(decimas / 10);
  return `${enteros.toLocaleString("es-ES")},${decimas % 10} %`;
}

/**
 * @param {{ aFavor: number; enContra: number; abstenciones: number }} resultados
 */
export function calcularReparto(resultados) {
  const total = OPCIONES_RESULTADO.reduce((suma, { clave }) => suma + resultados[clave], 0);
  if (total === 0) {
    return {
      total,
      filas: OPCIONES_RESULTADO.map(({ opcion, etiqueta, clave }) => ({
        opcion,
        etiqueta,
        votos: resultados[clave],
        decimas: null,
        porcentaje: null,
      })),
      sumaDecimas: null,
      sumaTexto: null,
      notaRedondeo: null,
    };
  }

  const filas = OPCIONES_RESULTADO.map(({ opcion, etiqueta, clave }) => {
    const decimas = decimasDePorcentaje(resultados[clave], total);
    return { opcion, etiqueta, votos: resultados[clave], decimas, porcentaje: formatearPorcentaje(decimas) };
  });
  const sumaDecimas = filas.reduce((suma, fila) => suma + fila.decimas, 0);
  const sumaTexto = formatearPorcentaje(sumaDecimas);

  return {
    total,
    filas,
    sumaDecimas,
    sumaTexto,
    notaRedondeo:
      sumaDecimas === 1000
        ? null
        : `Cada porcentaje está redondeado a un decimal; por eso la suma es ${sumaTexto} y no 100,0 %. Los números de votos son exactos.`,
  };
}
