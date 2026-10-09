import { expect, test } from "@playwright/test";
import {
  abrirVotacion,
  activarModoSencillo,
  comprobarAccesibilidad,
  identificarseConCertificado,
  simularApi,
} from "./utilidades";

// Hallazgo A-04: con una sola vía no hay voto cruzado. La página solo ofrece
// las vías que declara el servidor y, si no declara ninguna, solo certificado.

test.describe("voto único: una sola vía de identificación", () => {
  for (const sencillo of [false, true]) {
    test(`solo certificado: una tarjeta y el aviso de voto único (modo ${sencillo ? "sencillo" : "normal"})`, async ({
      page,
    }) => {
      await simularApi(page, { vias: ["certificado"] });
      await abrirVotacion(page);
      if (sencillo) await activarModoSencillo(page);

      await expect(page.locator(".metodo-card")).toHaveCount(1);
      await expect(page.locator(".metodo-card")).toContainText(/certificado digital/i);
      await expect(page.locator(".metodo-selector")).toContainText(
        sencillo ? "Así nadie puede votar dos veces." : "un único voto por persona"
      );
      await comprobarAccesibilidad(page, "selector con una sola vía");
    });
  }

  test("un servidor que no declara las vías solo ofrece certificado", async ({ page }) => {
    await simularApi(page, { vias: null });
    await abrirVotacion(page);
    await expect(page.locator(".metodo-card")).toHaveCount(1);
    await expect(page.locator(".metodo-card")).toContainText(/certificado digital/i);
  });

  test("solo ZKPassport: una tarjeta, la del DNI o pasaporte", async ({ page }) => {
    await simularApi(page, { vias: ["zk"] });
    await abrirVotacion(page);
    await expect(page.locator(".metodo-card")).toHaveCount(1);
    await expect(page.locator(".metodo-card")).toContainText("DNIe o pasaporte");
  });

  test("con las dos vías se ofrecen las dos, sin el aviso de vía única", async ({ page }) => {
    await simularApi(page, { vias: ["certificado", "zk"] });
    await abrirVotacion(page);
    await expect(page.locator(".metodo-card")).toHaveCount(2);
    await expect(page.locator(".metodo-selector")).not.toContainText("un único voto por persona");
  });

  test("tras varios intentos de volver a votar, el servidor bloquea y se explica", async ({ page }) => {
    const mensaje = "Demasiados intentos de volver a votar en esta propuesta. Cada persona solo puede votar una vez.";
    await simularApi(page, { vias: ["certificado"], respuestasVoto: [{ status: 429, body: { error: mensaje } }] });
    await abrirVotacion(page);
    await identificarseConCertificado(page);
    await page.getByLabel("A favor").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Sí", exact: true }).click();

    await expect(page.getByRole("alert").filter({ hasText: "solo puede votar una vez" })).toBeVisible();
    await expect(page.locator(".recibo, .nullifier")).toHaveCount(0);
    await comprobarAccesibilidad(page, "voto bloqueado por intentos repetidos");
  });
});
