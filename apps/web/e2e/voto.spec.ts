import { expect, test } from "@playwright/test";
import {
  MENSAJE_RETO_CADUCADO,
  NULLIFIER,
  abrirVotacion,
  activarModoSencillo,
  comprobarAccesibilidad,
  comprobarSinJerga,
  identificarseConCertificado,
  simularApi,
  simularVoces,
} from "./utilidades";

const VOZ_LOCAL = { name: "Helena", lang: "es-ES", localService: true };
const VOZ_EN_RED = { name: "Google español", lang: "es-ES", localService: false };

test.describe("flujo de voto: accesibilidad WCAG 2.1 AA", () => {
  for (const sencillo of [false, true]) {
    test(`sin infracciones en cada paso ${sencillo ? "(modo sencillo)" : "(modo normal)"}`, async ({ page }) => {
      await simularVoces(page, [VOZ_LOCAL]);
      await simularApi(page);
      await abrirVotacion(page);
      if (sencillo) await activarModoSencillo(page);
      await comprobarAccesibilidad(page, "elección de método");

      await page.locator(".metodo-card").first().click();
      await expect(page.locator(".alert-error, .estado-zk").first()).toBeVisible();
      await comprobarAccesibilidad(page, "identificación con DNIe");
      if (sencillo) await comprobarSinJerga(page, "identificación con DNIe");
      await page.locator(".metodo-volver").click();

      await page.locator(".metodo-card").nth(1).click();
      await expect(page.locator("#fecha-nacimiento-cert")).toBeVisible();
      await comprobarAccesibilidad(page, "identificación con certificado");
      await page.locator(".metodo-volver").click();

      await identificarseConCertificado(page);
      await comprobarAccesibilidad(page, "elección de opción");

      await page.getByLabel("En contra").check();
      await page.getByRole("button", { name: "Continuar" }).click();
      await comprobarAccesibilidad(page, "confirmación");

      await page.getByRole("button", { name: "Sí", exact: true }).click();
      await expect(page.locator(".recibo")).toHaveText(NULLIFIER);
      await comprobarAccesibilidad(page, "recibo");
    });
  }

  test("se puede votar solo con el teclado y el foco sigue al paso", async ({ page }) => {
    await simularApi(page);
    await abrirVotacion(page);
    await identificarseConCertificado(page);

    await expect(page.locator(".paso-titulo")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("A favor")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByLabel("En contra")).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Continuar" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator(".paso-titulo")).toBeFocused();
    await expect(page.locator(".paso-titulo")).toHaveText("Confirmación");
    await page.getByRole("button", { name: "Sí", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".recibo")).toBeVisible();
    // Los recibos solo se consultan tras el cierre: no se ofrece verificar ya.
    await expect(page.getByText(/Podrás verificarlo cuando cierre la votación, el /)).toBeVisible();
    await expect(page.getByRole("link", { name: /ahora/ })).toHaveCount(0);
  });
});

test.describe("confirmación final", () => {
  test("muestra la opción, permite volver y envía solo al pulsar Sí", async ({ page }) => {
    const { votos } = await simularApi(page);
    await abrirVotacion(page);
    await identificarseConCertificado(page);

    await page.getByLabel("Abstención").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator(".confirmacion-texto")).toHaveText("Va a votar: Abstención. ¿Es correcto?");
    expect(votos).toHaveLength(0);

    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page.getByLabel("Abstención")).toBeChecked();
    await page.getByLabel("A favor").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator(".confirmacion-texto")).toHaveText("Va a votar: A favor. ¿Es correcto?");

    await page.getByRole("button", { name: "Sí", exact: true }).click();
    await expect(page.locator(".recibo")).toBeVisible();
    expect(votos).toHaveLength(1);
    expect(votos[0]).toMatchObject({ opcion: "a_favor" });
  });

  test("la confirmación se escucha con un audio propio y no con speechSynthesis", async ({ page }) => {
    await simularVoces(page, [VOZ_LOCAL]);
    await simularApi(page);
    await abrirVotacion(page);
    await activarModoSencillo(page);
    await identificarseConCertificado(page);
    await page.getByLabel("En contra").check();
    await page.getByRole("button", { name: "Continuar" }).click();

    const audio = page.locator(".confirmacion-voto audio").first();
    await expect(audio).toHaveAttribute("src", "/audio/confirmacion/en_contra.wav");
    const respuesta = await page.request.get("/audio/confirmacion/en_contra.wav");
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toContain("audio/");

    await page.getByRole("button", { name: "Escuchar" }).click();
    const leido = await page.evaluate(() => (window as unknown as { __leido: unknown[] }).__leido);
    expect(leido).toEqual([]);
  });

  test("la CSP de next start permite solo medios propios y nunca 'unsafe-eval'", async ({ page }) => {
    const respuesta = await page.goto("/votar");
    const csp = respuesta?.headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/media-src 'self'(;|$)/);
    expect(csp).not.toContain("unsafe-eval");
  });
});

test.describe("modo sencillo", () => {
  test("se recuerda al recargar y aplica letra de 20 px, botones de 48 px y sin jerga", async ({ page }) => {
    await simularVoces(page, [VOZ_LOCAL]);
    await simularApi(page);
    await abrirVotacion(page);
    await activarModoSencillo(page);

    await page.reload();
    await expect(page.getByRole("switch", { name: "Modo sencillo" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".flujo-voto.modo-sencillo")).toBeVisible();

    const comprobarPantalla = async (contexto: string) => {
      await comprobarSinJerga(page, contexto);
      const tamanos = await page
        .locator(".flujo-voto :is(p, label, legend, .metodo-card-desc)")
        .evaluateAll((nodos) =>
          nodos.filter((n) => (n as HTMLElement).offsetParent).map((n) => parseFloat(getComputedStyle(n).fontSize))
        );
      expect(Math.min(...tamanos), `letra en ${contexto}`).toBeGreaterThanOrEqual(20);
      const altos = await page
        .locator(".flujo-voto button")
        .evaluateAll((nodos) =>
          nodos.filter((n) => (n as HTMLElement).offsetParent).map((n) => n.getBoundingClientRect().height)
        );
      expect(Math.min(...altos), `botones en ${contexto}`).toBeGreaterThanOrEqual(48);
    };

    await comprobarPantalla("elección de método");
    await page.locator(".metodo-card").nth(1).click();
    await expect(page.locator("#fecha-nacimiento-cert")).toBeVisible();
    await comprobarPantalla("certificado");
    await page.locator(".metodo-volver").click();
    await identificarseConCertificado(page);
    await comprobarPantalla("elección");
    await page.getByLabel("A favor").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await comprobarPantalla("confirmación");
    await page.getByRole("button", { name: "Sí", exact: true }).click();
    await expect(page.locator(".recibo")).toBeVisible();
    await comprobarPantalla("recibo");
  });

  test("los avisos fijos están en todas las páginas de votación", async ({ page }) => {
    await simularApi(page);
    for (const ruta of ["/votar", `/votar/${"6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b"}`]) {
      await page.goto(ruta);
      await expect(page.getByRole("switch", { name: "Modo sencillo" })).toBeVisible();
      await expect(page.getByText("Nadie puede pedirle ver su voto.")).toBeVisible();
      await expect(page.getByText("¿Necesita ayuda?")).toBeVisible();
    }
  });

  test("funciona aunque localStorage no esté disponible", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("bloqueado", "SecurityError");
        },
      });
    });
    await simularApi(page);
    await abrirVotacion(page);
    await activarModoSencillo(page);
    await expect(page.locator(".flujo-voto.modo-sencillo")).toBeVisible();
  });
});

test.describe("botón Escuchar", () => {
  test("lee la pantalla con una voz local es-ES", async ({ page }) => {
    await simularVoces(page, [VOZ_EN_RED, VOZ_LOCAL]);
    await simularApi(page);
    await abrirVotacion(page);
    await activarModoSencillo(page);

    await page.getByRole("button", { name: "Escuchar" }).click();
    const leido = await page.evaluate(
      () => (window as unknown as { __leido: { texto: string; voz: string }[] }).__leido
    );
    expect(leido).toHaveLength(1);
    expect(leido[0].voz).toBe("Helena");
    expect(leido[0].texto).toContain("Primero tiene que identificarse");
  });

  test("se oculta con un aviso si solo hay voces en red", async ({ page }) => {
    await simularVoces(page, [VOZ_EN_RED]);
    await simularApi(page);
    await abrirVotacion(page);
    await activarModoSencillo(page);
    await expect(page.getByText("La lectura en voz alta no está disponible en este navegador.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Escuchar" })).toHaveCount(0);
  });

  test("se oculta con un aviso si el navegador no tiene síntesis de voz", async ({ page }) => {
    await simularVoces(page, null);
    await simularApi(page);
    await abrirVotacion(page);
    await activarModoSencillo(page);
    await expect(page.getByText("La lectura en voz alta no está disponible en este navegador.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Escuchar" })).toHaveCount(0);
  });
});

test.describe("firma del voto con certificado (R-04)", () => {
  test("pide el reto con la opción solo al pulsar Sí y avisa antes de abrir Autofirma", async ({ page }) => {
    const { votos, contador, opcionesReto } = await simularApi(page);
    await abrirVotacion(page);
    await identificarseConCertificado(page);
    expect(contador.retos).toBe(0);

    await page.getByLabel("Abstención").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    const aviso = page.locator("#aviso-autofirma");
    await expect(aviso).toHaveText("Al pulsar «Sí» se abrirá Autofirma para que firmes tu voto con tu certificado digital.");
    await expect(page.getByRole("button", { name: "Sí", exact: true })).toHaveAttribute("aria-describedby", "aviso-autofirma");
    await expect(page.locator(".confirmacion-voto audio").nth(1)).toHaveAttribute(
      "src",
      "/audio/confirmacion/aviso-autofirma.wav"
    );
    expect(contador.retos).toBe(0);

    await page.getByRole("button", { name: "Sí", exact: true }).click();
    await expect(page.locator(".recibo")).toBeVisible();
    expect(opcionesReto).toEqual(["abstencion"]);
    expect(votos[0]).toMatchObject({ opcion: "abstencion", reto: "ab".repeat(32) });
    const firmado = await page.evaluate(() => (window as unknown as { __firmado: string[] }).__firmado);
    expect(firmado).toEqual([Buffer.from("ab".repeat(32), "hex").toString("base64")]);
  });

  test("el aviso de Autofirma también aparece en modo sencillo", async ({ page }) => {
    await simularApi(page);
    await abrirVotacion(page);
    await activarModoSencillo(page);
    await identificarseConCertificado(page);
    await page.getByLabel("A favor").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator("#aviso-autofirma")).toHaveText(
      "Al pulsar «Sí» se abrirá Autofirma para que firme su voto con su certificado."
    );
  });

  test("si se cancela la firma, se queda en la confirmación sin enviar el voto", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __autofirmaFalla: boolean }).__autofirmaFalla = true;
    });
    const { votos } = await simularApi(page);
    await abrirVotacion(page);
    await identificarseConCertificado(page);
    await page.getByLabel("En contra").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Sí", exact: true }).click();

    await expect(page.getByRole("alert").filter({ hasText: "cancelada" })).toBeVisible();
    await expect(page.locator(".confirmacion-texto")).toHaveText("Va a votar: En contra. ¿Es correcto?");
    expect(votos).toHaveLength(0);
  });
});

test.describe("reto de certificado caducado", () => {
  test("avisa en la confirmación y permite firmar de nuevo conservando la opción", async ({ page }) => {
    const { votos, contador, opcionesReto } = await simularApi(page, {
      respuestasVoto: [
        { status: 400, body: { error: MENSAJE_RETO_CADUCADO } },
        { status: 200, body: { nullifier: NULLIFIER } },
      ],
    });
    await abrirVotacion(page);
    await identificarseConCertificado(page);
    await page.getByLabel("En contra").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Sí", exact: true }).click();

    await expect(page.getByRole("alert").filter({ hasText: "La firma ha caducado" })).toBeVisible();
    await expect(page.locator(".confirmacion-texto")).toHaveText("Va a votar: En contra. ¿Es correcto?");

    await page.getByRole("button", { name: "Firmar de nuevo" }).click();
    await expect(page.locator(".recibo")).toHaveText(NULLIFIER);
    expect(contador.retos).toBe(2);
    expect(opcionesReto).toEqual(["en_contra", "en_contra"]);
    expect(votos).toHaveLength(2);
    expect(votos[1]).toMatchObject({ opcion: "en_contra" });
  });
});
