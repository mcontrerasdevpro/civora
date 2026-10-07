import { expect, test, type Page } from "@playwright/test";
import { PROPUESTA_ID, comprobarAccesibilidad, comprobarSinJerga } from "./utilidades";

const CONTRATO = "0xe5B87219E2dda01c61f8491Cc6AcEd5dD85C1Ed6";
const EXPLORADOR = "https://explorador.example";
const TX = ["0x" + "1".repeat(64), "0x" + "2".repeat(64), "0x" + "3".repeat(64)];

function propuesta(cerrada: boolean) {
  const ahora = Date.now();
  return {
    schema: "propuesta/v1",
    id: PROPUESTA_ID,
    titulo: "Carril bici en la avenida principal",
    descripcion: "",
    pregunta: "¿Quiere que se construya un carril bici en la avenida principal?",
    opciones: ["a_favor", "en_contra", "abstencion"],
    fechaApertura: new Date(ahora - 3 * 86_400_000).toISOString(),
    fechaCierre: new Date(ahora + (cerrada ? -86_400_000 : 86_400_000)).toISOString(),
    elegibilidad: { requiereEmpadronamiento: true, requiereDniEspanol: true, anosResidenciaMinimos: 5, edadMinima: 18 },
  };
}

function verificacion(recuento: Record<string, unknown>) {
  return {
    contrato: CONTRATO,
    explorador: EXPLORADOR,
    propuestaIdBytes32: "0x" + "ab".repeat(32),
    firmaEvento: "VotoEmitido(bytes32,bytes32,uint8)",
    topicEvento: "0x" + "cd".repeat(32),
    bloques: { desde: 9_000_000, hasta: 9_000_300 },
    recuento,
  };
}

const RECUENTO_COMPLETO = {
  disponible: true,
  aFavor: 1,
  enContra: 1,
  abstenciones: 1,
  total: 3,
  porVia: { certificado: 1, zk: 2, otra: 0 },
  duplicados: 0,
  transacciones: TX,
  totalTransacciones: 3,
  contrato: { aFavor: 1, enContra: 1, abstenciones: 1 },
  coincide: true,
  indiceHastaBloque: 9_000_400,
};

/** Simula las API de resultados y anota si se pidió la verificación. */
async function simular(
  page: Page,
  opciones: {
    cerrada: boolean;
    resultados?: { aFavor: number; enContra: number; abstenciones: number };
    recuento?: Record<string, unknown>;
  }
) {
  const pedidas = { verificacion: 0 };
  const resultados = opciones.resultados ?? { aFavor: 1, enContra: 1, abstenciones: 1 };
  await page.route(`**/api/propuestas/${PROPUESTA_ID}`, (ruta) =>
    ruta.fulfill({
      json: {
        propuesta: propuesta(opciones.cerrada),
        resultados: opciones.cerrada
          ? {
              propuestaId: PROPUESTA_ID,
              registrados: resultados.aFavor + resultados.enContra + resultados.abstenciones,
              ...resultados,
            }
          : null,
      },
    })
  );
  await page.route(`**/api/propuestas/${PROPUESTA_ID}/verificacion`, (ruta) => {
    pedidas.verificacion += 1;
    return opciones.cerrada
      ? ruta.fulfill({ json: { verificacion: verificacion(opciones.recuento ?? RECUENTO_COMPLETO) } })
      : ruta.fulfill({ status: 423, json: { error: "La verificación estará disponible tras el cierre." } });
  });
  return pedidas;
}

test.describe("resultados antes del cierre", () => {
  test("no muestra gráfica, tabla ni verificación; solo cuándo se publicarán", async ({ page }) => {
    const pedidas = await simular(page, { cerrada: false });
    await page.goto(`/resultados/${PROPUESTA_ID}`);

    await expect(page.getByText("Los resultados se publicarán cuando cierre la votación")).toBeVisible();
    await expect(page.locator(".grafico-resultados")).toHaveCount(0);
    await expect(page.locator(".tabla-resultados")).toHaveCount(0);
    await expect(page.getByText("Verifica este resultado")).toHaveCount(0);
    await expect(page.getByText(/%/)).toHaveCount(0);
    expect(pedidas.verificacion).toBe(0);
    await comprobarAccesibilidad(page, "resultados ocultos");
  });
});

test.describe("resultados tras el cierre", () => {
  test("gráfica y tabla con votos y porcentajes, nota de redondeo y participación", async ({ page }) => {
    await simular(page, { cerrada: true });
    await page.goto(`/resultados/${PROPUESTA_ID}`);

    const grafico = page.getByRole("figure", { name: "Votos emitidos por opción" });
    await expect(grafico).toBeVisible();
    for (const etiqueta of ["A favor", "En contra", "Abstención"]) {
      await expect(grafico.getByRole("listitem").filter({ hasText: etiqueta })).toContainText("1 voto · 33,3 %");
    }

    const tabla = page.getByRole("table", { name: "Resultados en tabla" });
    await expect(tabla.getByRole("row", { name: /A favor 1 33,3 %/ })).toBeVisible();
    await expect(tabla.getByRole("row", { name: /Total de votos emitidos 3 99,9 %/ })).toBeVisible();
    await expect(page.getByText(/redondeado a un decimal; por eso la suma es 99,9 %/)).toBeVisible();

    await expect(page.getByText(/hace falta un censo cerrado, previsto en la Fase 1/)).toBeVisible();
    await expect(page.getByText("Resultado final")).toBeVisible();
    await comprobarAccesibilidad(page, "resultados publicados");
  });

  test("desglose por vía y sección para verificar con enlaces al explorador", async ({ page }) => {
    await simular(page, { cerrada: true });
    await page.goto(`/resultados/${PROPUESTA_ID}`);

    const vias = page.getByRole("table", { name: "Votos por vía de identificación" });
    await expect(vias.getByRole("row", { name: "Certificado digital 1" })).toBeVisible();
    await expect(vias.getByRole("row", { name: "DNIe o pasaporte (ZKPassport) 2" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Verifica este resultado" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "coincide con el que guarda el contrato" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(TX[0]) })).toHaveAttribute("href", `${EXPLORADOR}/tx/${TX[0]}`);
    await expect(page.getByRole("link", { name: new RegExp(CONTRATO) })).toHaveAttribute(
      "href",
      `${EXPLORADOR}/address/${CONTRATO}#events`
    );
    await expect(page.locator(".comando")).toContainText("--from-block 9000000 --to-block 9000300");
    await comprobarAccesibilidad(page, "verificación de resultados");
  });

  test("una discrepancia entre los eventos y el contrato se muestra con las dos cifras", async ({ page }) => {
    await simular(page, {
      cerrada: true,
      recuento: { ...RECUENTO_COMPLETO, aFavor: 2, abstenciones: 0, coincide: false },
    });
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await expect(page.getByRole("alert").filter({ hasText: "no coincide con el del contrato" })).toBeVisible();
    const detalle = page.locator(".discrepancia");
    await expect(detalle).toContainText("Desde los eventos: A favor 2, En contra 1, Abstención 0.");
    await expect(detalle).toContainText("En el contrato: A favor 1, En contra 1, Abstención 1.");
    await comprobarAccesibilidad(page, "discrepancia");
  });

  test("en modo sencillo la discrepancia también se ve, fuera de la sección plegada", async ({ page }) => {
    await simular(page, { cerrada: true, recuento: { ...RECUENTO_COMPLETO, aFavor: 2, abstenciones: 0, coincide: false } });
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await page.getByRole("switch", { name: "Modo sencillo" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "hay una diferencia entre dos copias del recuento" })).toBeVisible();
    await comprobarSinJerga(page, "discrepancia en modo sencillo");
  });

  test("mientras el índice se completa, lo explica y remite a los pasos", async ({ page }) => {
    await simular(page, { cerrada: true, recuento: { disponible: false, motivo: "indexando", indiceHastaBloque: 9_000_100 } });
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await expect(page.getByText(/todavía está copiando los eventos de la red para esta votación \(va por el bloque 9\.000\.100\)/)).toBeVisible();
    await expect(page.getByText(/votos por vía de identificación no están disponibles/i)).toBeVisible();
    await comprobarAccesibilidad(page, "verificación no disponible");
  });

  test("sin votos: lo dice y no inventa porcentajes", async ({ page }) => {
    await simular(page, { cerrada: true, resultados: { aFavor: 0, enContra: 0, abstenciones: 0 } });
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await expect(page.getByText("No se emitió ningún voto en esta votación.")).toBeVisible();
    await expect(page.locator(".grafico-resultados")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Total de votos emitidos 0/ })).toBeVisible();
  });

  test("modo sencillo: letra grande, sin jerga y verificación plegada", async ({ page }) => {
    await simular(page, { cerrada: true });
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await page.getByRole("switch", { name: "Modo sencillo" }).click();

    await expect(page.locator(".modo-sencillo")).toBeVisible();
    await expect(page.getByRole("figure", { name: "Votos emitidos por opción" })).toBeVisible();
    await expect(page.getByText("Datos leídos del registro público de votos.")).toBeVisible();
    const resumen = page.getByText("Comprobar este resultado por su cuenta");
    await expect(resumen).toBeVisible();
    await expect(page.locator(".comando")).toBeHidden();

    await comprobarSinJerga(page, "resultados en modo sencillo");
    await comprobarAccesibilidad(page, "resultados en modo sencillo");

    // Se puede desplegar con el teclado.
    await resumen.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".comando")).toBeVisible();
  });
});
