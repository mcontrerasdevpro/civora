import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import {
  NULLIFIER,
  abrirVotacion,
  activarModoSencillo,
  comprobarAccesibilidad,
  comprobarSinJerga,
  identificarseConCertificado,
  simularApi,
} from "./utilidades";

const OPCIONES = ["A favor", "En contra", "Abstención"];

/** Sustituye window.print para contar cuántas veces se llama. */
async function vigilarImpresion(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __impresiones: number; print: () => void };
    w.__impresiones = 0;
    w.print = () => {
      w.__impresiones += 1;
    };
  });
}

async function votarHastaElRecibo(page: Page, sencillo = false) {
  await simularApi(page);
  await abrirVotacion(page);
  if (sencillo) await activarModoSencillo(page);
  await identificarseConCertificado(page);
  await page.getByLabel("En contra").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await expect(page.locator(".recibo")).toHaveText(NULLIFIER);
}

/** Ninguna petición de red mientras dura `accion`. */
async function sinPeticiones(page: Page, accion: () => Promise<void>) {
  const peticiones: string[] = [];
  const anotar = (peticion: { url: () => string }) => peticiones.push(peticion.url());
  page.on("request", anotar);
  await accion();
  page.off("request", anotar);
  expect(peticiones, "el justificante no debe enviar nada").toEqual([]);
}

test.describe("justificante de participación", () => {
  test("es opcional: no se crea ni se imprime si no se pide", async ({ page }) => {
    await vigilarImpresion(page);
    await votarHastaElRecibo(page);

    await expect(page.getByRole("button", { name: "Obtener justificante" })).toBeVisible();
    await expect(page.locator(".justificante")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones)).toBe(0);
  });

  test("el recibo no se envía al servidor por precarga del enlace a /verificar", async ({ page }) => {
    const conRecibo: string[] = [];
    page.on("request", (peticion) => {
      if (peticion.url().includes(NULLIFIER)) conRecibo.push(peticion.url());
    });
    await votarHastaElRecibo(page);
    await page.waitForLoadState("networkidle");
    expect(conRecibo).toEqual([]);
  });

  test("al pedirlo, muestra solo propuesta, periodo y el aviso de voto secreto", async ({ page }) => {
    await vigilarImpresion(page);
    await votarHastaElRecibo(page);

    await sinPeticiones(page, async () => {
      await page.getByRole("button", { name: "Obtener justificante" }).click();
      await expect(page.getByRole("heading", { name: "Justificante de participación" })).toBeFocused();
    });

    const justificante = page.locator(".justificante");
    await expect(justificante).toContainText("Carril bici en la avenida principal");
    await expect(justificante).toContainText(/Del \d+ de \w+ de \d{4} al \d+ de \w+ de \d{4}/);
    await expect(justificante).toContainText("Su voto ha quedado registrado de forma secreta.");
    const texto = await justificante.innerText();
    for (const opcion of OPCIONES) expect(texto).not.toContain(opcion);
    expect(texto).not.toContain(NULLIFIER);
    expect(texto).not.toMatch(/\d{1,2}:\d{2}/);
    await comprobarAccesibilidad(page, "justificante");
  });

  test("Descargar PDF: se genera en el navegador y no contiene la opción ni el recibo", async ({ page }) => {
    await votarHastaElRecibo(page);
    await page.getByRole("button", { name: "Obtener justificante" }).click();

    let archivo: Download | undefined;
    await sinPeticiones(page, async () => {
      [archivo] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Descargar PDF" }).click(),
      ]);
    });
    if (!archivo) throw new Error("No se ha descargado el PDF");
    expect(archivo.suggestedFilename()).toBe("justificante-participacion-civora.pdf");
    const pdf = (await readFile(await archivo.path())).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Carril bici en la avenida principal");
    expect(pdf).not.toContain(NULLIFIER.slice(2, 22));
    expect(pdf).not.toMatch(/A favor|En contra|Abstenci|CreationDate/);
  });

  test("Imprimir: solo sale el justificante, nunca el recibo", async ({ page }) => {
    await vigilarImpresion(page);
    await votarHastaElRecibo(page);
    await page.getByRole("button", { name: "Obtener justificante" }).click();

    await sinPeticiones(page, async () => {
      await page.getByRole("button", { name: "Imprimir" }).click();
    });
    expect(await page.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones)).toBe(1);

    // En pantalla, la copia de impresión no se ve.
    await expect(page.locator(".justificante-impresion")).toBeHidden();
    await page.emulateMedia({ media: "print" });
    const impreso = page.locator(".justificante-impresion");
    await expect(impreso).toBeVisible();
    await expect(impreso).toContainText("Su voto ha quedado registrado de forma secreta.");
    await expect(page.locator(".recibo")).toBeHidden();
    await expect(page.locator("main")).toBeHidden();
    await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeHidden();
    const color = await impreso.evaluate((e) => getComputedStyle(e).color);
    expect(color).toBe("rgb(0, 0, 0)");
    await comprobarAccesibilidad(page, "justificante impreso");
  });

  test("modo sencillo: botón grande, sin jerga y accesible", async ({ page }) => {
    await votarHastaElRecibo(page, true);
    const boton = page.getByRole("button", { name: "Obtener justificante" });
    expect((await boton.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await boton.click();
    await expect(page.locator(".justificante")).toBeVisible();
    await comprobarSinJerga(page, "justificante en modo sencillo");
    await comprobarAccesibilidad(page, "justificante en modo sencillo");

    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.locator(".justificante")).toHaveCount(0);
  });
});
