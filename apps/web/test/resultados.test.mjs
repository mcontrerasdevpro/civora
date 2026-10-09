import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularReparto,
  decimasDePorcentaje,
  formatearPorcentaje,
} from "../lib/porcentajes-resultados.mjs";
import {
  mismoRecuento,
  primerBloqueDesde,
  primerBloqueQueCumple,
  rangosDeBloques,
  rangosDelCiclo,
  recontarEventos,
  viaDeSelector,
} from "../lib/recuento-eventos.mjs";
import { segmentoDesdeElFinal } from "../lib/parametros-ruta.mjs";

test("décimas de porcentaje: redondeo al más próximo, empates hacia arriba", () => {
  assert.equal(decimasDePorcentaje(1, 3), 333);
  assert.equal(decimasDePorcentaje(2, 3), 667);
  assert.equal(decimasDePorcentaje(1, 16), 63); // 6,25 % → 6,3 %
  assert.equal(decimasDePorcentaje(1, 8), 125); // 12,5 % exacto
  assert.equal(decimasDePorcentaje(0, 5), 0);
  assert.equal(decimasDePorcentaje(5, 5), 1000);
  assert.equal(decimasDePorcentaje(1, 2000), 1); // 0,05 % → 0,1 %
  assert.equal(decimasDePorcentaje(1, 2001), 0); // 0,049… % → 0,0 %
});

test("décimas de porcentaje: rechaza recuentos imposibles", () => {
  assert.throws(() => decimasDePorcentaje(1, 0), RangeError);
  assert.throws(() => decimasDePorcentaje(4, 3), RangeError);
  assert.throws(() => decimasDePorcentaje(-1, 3), RangeError);
  assert.throws(() => decimasDePorcentaje(1.5, 3), RangeError);
});

test("formato español con un decimal", () => {
  assert.equal(formatearPorcentaje(333), "33,3 %");
  assert.equal(formatearPorcentaje(1000), "100,0 %");
  assert.equal(formatearPorcentaje(5), "0,5 %");
  assert.equal(formatearPorcentaje(0), "0,0 %");
});

test("reparto exacto: suma 100,0 % y sin nota de redondeo", () => {
  const reparto = calcularReparto({ aFavor: 6, enContra: 3, abstenciones: 1 });
  assert.equal(reparto.total, 10);
  assert.deepEqual(
    reparto.filas.map((f) => [f.etiqueta, f.votos, f.porcentaje]),
    [
      ["A favor", 6, "60,0 %"],
      ["En contra", 3, "30,0 %"],
      ["Abstención", 1, "10,0 %"],
    ]
  );
  assert.equal(reparto.sumaTexto, "100,0 %");
  assert.equal(reparto.notaRedondeo, null);
});

test("reparto con redondeo: explica por qué la suma no da 100", () => {
  // 1/3 de cada: 33,3 % × 3 = 99,9 %.
  const tercios = calcularReparto({ aFavor: 1, enContra: 1, abstenciones: 1 });
  assert.equal(tercios.sumaTexto, "99,9 %");
  assert.match(tercios.notaRedondeo, /redondeado a un decimal.*99,9 %.*100,0 %/);

  // 1/6, 1/6 y 4/6: 16,7 + 16,7 + 66,7 = 100,1 %.
  const sextos = calcularReparto({ aFavor: 1, enContra: 1, abstenciones: 4 });
  assert.deepEqual(sextos.filas.map((f) => f.porcentaje), ["16,7 %", "16,7 %", "66,7 %"]);
  assert.equal(sextos.sumaTexto, "100,1 %");
  assert.ok(sextos.notaRedondeo);
});

test("reparto sin votos: sin porcentajes ni división por cero", () => {
  const reparto = calcularReparto({ aFavor: 0, enContra: 0, abstenciones: 0 });
  assert.equal(reparto.total, 0);
  assert.ok(reparto.filas.every((f) => f.porcentaje === null && f.decimas === null));
  assert.equal(reparto.sumaTexto, null);
  assert.equal(reparto.notaRedondeo, null);
});

const SELECTORES = { certificado: "0xaaaaaaaa", zk: "0xbbbbbbbb" };

test("vía de cada voto según la función de su transacción", () => {
  assert.equal(viaDeSelector("0xAAAAAAAA", SELECTORES), "certificado");
  assert.equal(viaDeSelector("0xbbbbbbbb", SELECTORES), "zk");
  assert.equal(viaDeSelector("0xcccccccc", SELECTORES), "otra");
  assert.equal(viaDeSelector(null, SELECTORES), "otra");
});

test("recuento desde eventos, con desglose por vía", () => {
  const recuento = recontarEventos(
    [
      { opcion: 0, nullifier: "0x01", selector: "0xaaaaaaaa" },
      { opcion: 0, nullifier: "0x02", selector: "0xbbbbbbbb" },
      { opcion: 1, nullifier: "0x03", selector: "0xbbbbbbbb" },
      { opcion: 2, nullifier: "0x04", selector: null },
    ],
    SELECTORES
  );
  assert.deepEqual(recuento, {
    aFavor: 2,
    enContra: 1,
    abstenciones: 1,
    total: 4,
    porVia: { certificado: 1, zk: 2, otra: 1 },
    duplicados: 0,
  });
  assert.ok(mismoRecuento(recuento, { aFavor: 2, enContra: 1, abstenciones: 1 }));
  assert.ok(!mismoRecuento(recuento, { aFavor: 2, enContra: 2, abstenciones: 0 }));
});

test("recuento desde eventos: un nullifier repetido cuenta una vez y se informa", () => {
  const recuento = recontarEventos(
    [
      { opcion: 0, nullifier: "0xAB", selector: null },
      { opcion: 1, nullifier: "0xab", selector: null },
    ],
    null
  );
  assert.equal(recuento.total, 1);
  assert.equal(recuento.aFavor, 1);
  assert.equal(recuento.duplicados, 1);
  assert.equal(recuento.porVia, null);
});

test("recuento desde eventos: una opción desconocida es un error, no se ignora", () => {
  assert.throws(() => recontarEventos([{ opcion: 3, nullifier: "0x01", selector: null }], null), RangeError);
});

test("primer bloque con timestamp >= objetivo (búsqueda binaria)", async () => {
  // Bloque n tiene timestamp 1000 + 12·n.
  let consultas = 0;
  const timestampDe = async (n) => {
    consultas += 1;
    return 1000 + 12 * n;
  };
  assert.equal(await primerBloqueDesde(timestampDe, 0, 1_000_000, 1000), 0);
  assert.equal(await primerBloqueDesde(timestampDe, 0, 1_000_000, 1012), 1);
  assert.equal(await primerBloqueDesde(timestampDe, 0, 1_000_000, 1013), 2);
  assert.equal(await primerBloqueDesde(timestampDe, 0, 100, 999_999), 100);
  assert.ok(consultas < 4 * 25, "debe ser logarítmica");
});

test("rangos de bloques para proveedores que limitan eth_getLogs", () => {
  assert.deepEqual(rangosDeBloques(100, 125, 10), [
    [100, 109],
    [110, 119],
    [120, 125],
  ]);
  assert.deepEqual(rangosDeBloques(5, 5, 10), [[5, 5]]);
  assert.throws(() => rangosDeBloques(0, 10, 0), RangeError);
});

test("segmentoDesdeElFinal lee el id de rutas anidadas", () => {
  const peticion = new Request("http://x/api/propuestas/6f1c2b3a-4d5e/verificacion");
  assert.equal(segmentoDesdeElFinal(peticion, 2), "6f1c2b3a-4d5e");
  assert.equal(segmentoDesdeElFinal(peticion, 1), "verificacion");
});

test("primer bloque que cumple: bloque de despliegue del contrato", async () => {
  const conCodigo = async (n) => n >= 4_321_000;
  assert.equal(await primerBloqueQueCumple(conCodigo, 0, 9_000_000), 4_321_000);
  assert.equal(await primerBloqueQueCumple(async () => false, 0, 50), 50);
});

test("rangos de un ciclo del indexador: continúa donde lo dejó y respeta el máximo", () => {
  assert.deepEqual(rangosDelCiclo(99, 125, 10, 100), [
    [100, 109],
    [110, 119],
    [120, 125],
  ]);
  assert.deepEqual(rangosDelCiclo(99, 1_000, 10, 2), [
    [100, 109],
    [110, 119],
  ]);
  assert.deepEqual(rangosDelCiclo(125, 125, 10, 100), []);
  assert.deepEqual(rangosDelCiclo(130, 125, 10, 100), []);
});
