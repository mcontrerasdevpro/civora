import { expect, test, type Page } from "@playwright/test";
import { NULLIFIER, PROPUESTA_ID, simularApi } from "./utilidades";

const RUTAS = [
  "/",
  "/propuestas",
  "/propuestas/nueva",
  "/verificar",
  "/resultados",
  "/votar",
  `/votar/${PROPUESTA_ID}`,
  `/resultados/${PROPUESTA_ID}`,
];

/** Anota en window.__violaciones cada bloqueo de la CSP. */
async function vigilarCsp(page: Page) {
  await page.addInitScript(() => {
    const violaciones: string[] = [];
    (window as unknown as { __violaciones: string[] }).__violaciones = violaciones;
    document.addEventListener("securitypolicyviolation", (e) =>
      violaciones.push(`${e.effectiveDirective} ${e.blockedURI || "inline"}`)
    );
  });
  const consola: string[] = [];
  page.on("console", (mensaje) => {
    if (/Content Security Policy/i.test(mensaje.text())) consola.push(mensaje.text());
  });
  return consola;
}

async function simularListado(page: Page) {
  await page.route("**/api/propuestas", (ruta) =>
    ruta.fulfill({
      json: {
        propuestas: [
          {
            id: PROPUESTA_ID,
            titulo: "Carril bici en la avenida principal",
            pregunta: "¿Quiere que se construya un carril bici?",
            fechaApertura: new Date(Date.now() - 86_400_000).toISOString(),
            fechaCierre: new Date(Date.now() + 86_400_000).toISOString(),
          },
        ],
      },
    })
  );
}

test.describe("CSP en todas las páginas", () => {
  for (const ruta of RUTAS) {
    test(`${ruta}: todos los scripts llevan nonce y no hay bloqueos`, async ({ page }) => {
      const consola = await vigilarCsp(page);
      await simularApi(page);
      await simularListado(page);

      const respuesta = await page.goto(ruta);
      expect(respuesta?.status()).toBe(200);
      const html = await respuesta!.text();
      const sinNonce = (html.match(/<script\b[^>]*>/gi) ?? []).filter((etiqueta) => !/\snonce="[^"]+"/i.test(etiqueta));
      expect(sinNonce, `scripts sin nonce en ${ruta}`).toEqual([]);

      await page.waitForLoadState("networkidle");
      const violaciones = await page.evaluate(() => (window as unknown as { __violaciones: string[] }).__violaciones);
      expect(violaciones, `bloqueos de CSP en ${ruta}`).toEqual([]);
      expect(consola, `avisos de CSP en ${ruta}`).toEqual([]);
    });
  }

  // Los demás E2E simulan Autofirma; aquí se prueban las conexiones reales
  // de autoscript.js contra la CSP, aunque no haya nada escuchando.
  test("la CSP deja abrir Autofirma y conectar con ella en 127.0.0.1", async ({ page }) => {
    const consola = await vigilarCsp(page);
    await simularApi(page);
    await page.goto(`/votar/${PROPUESTA_ID}`);

    await page.evaluate(async () => {
      const marco = document.createElement("iframe");
      marco.style.display = "none";
      marco.src = "afirma://websocket?ports=63117&v=4";
      document.body.appendChild(marco);
      new WebSocket("wss://127.0.0.1:63117");
      await fetch("https://127.0.0.1:63117/").catch(() => undefined);
      await new Promise((resolver) => setTimeout(resolver, 500));
    });

    const violaciones = await page.evaluate(() => (window as unknown as { __violaciones: string[] }).__violaciones);
    expect(violaciones).toEqual([]);
    expect(consola).toEqual([]);
  });

  test("/logo.png se sirve como imagen (lo descarga la app de ZKPassport)", async ({ request }) => {
    const respuesta = await request.get("/logo.png");
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toBe("image/png");
  });

  test("cabeceras: sin X-Powered-By y con Referrer-Policy no-referrer", async ({ request }) => {
    for (const ruta of ["/", "/verificar"]) {
      const cabeceras = (await request.get(ruta)).headers();
      expect(cabeceras["x-powered-by"], ruta).toBeUndefined();
      expect(cabeceras["referrer-policy"], ruta).toBe("no-referrer");
    }
  });
});

test.describe("las páginas cliente arrancan", () => {
  test("/propuestas muestra el listado", async ({ page }) => {
    await simularListado(page);
    await page.goto("/propuestas");
    await expect(page.getByRole("heading", { name: "Carril bici en la avenida principal" })).toBeVisible();
  });

  test("/propuestas/nueva crea una propuesta sin clave de administrador", async ({ page }) => {
    const envios: { autorizacion: string | null; cuerpo: unknown }[] = [];
    await page.route("**/api/propuestas", (ruta) => {
      if (ruta.request().method() !== "POST") return ruta.fulfill({ json: { propuestas: [] } });
      envios.push({ autorizacion: ruta.request().headers()["authorization"] ?? null, cuerpo: ruta.request().postDataJSON() });
      return ruta.fulfill({ status: 201, json: { propuesta: { id: PROPUESTA_ID } } });
    });
    await page.goto("/propuestas/nueva");
    await expect(page.getByLabel("Clave de administrador")).toHaveCount(0);
    await page.getByLabel("Título").fill("Prueba");
    await page.getByLabel("¿Qué se quiere votar?").fill("¿Sí o no?");
    await page.getByRole("button", { name: "Crear propuesta" }).click();
    await expect(page).toHaveURL(/\/propuestas$/);
    expect(envios).toHaveLength(1);
    expect(envios[0].autorizacion).toBeNull();
    expect(envios[0].cuerpo).toMatchObject({ titulo: "Prueba", pregunta: "¿Sí o no?" });
  });

  test("/verificar comprueba un recibo", async ({ page }) => {
    await page.route(/\/api\/propuesta\/votos\/0x/, (ruta) =>
      ruta.fulfill({ json: { encontrado: true, opcion: "a_favor", timestamp: null } })
    );
    await page.goto(`/verificar?propuestaId=${PROPUESTA_ID}&nullifier=${NULLIFIER}`);
    await page.getByRole("button", { name: "Comprobar" }).click();
    await expect(page.getByText("Tu voto está contado")).toBeVisible();
  });

  test("/verificar explica que el recibo se consulta tras el cierre (423)", async ({ page }) => {
    await page.route(/\/api\/propuesta\/votos\/0x/, (ruta) =>
      ruta.fulfill({ status: 423, json: { error: "Los recibos estarán disponibles tras el cierre." } })
    );
    await page.goto(`/verificar?propuestaId=${PROPUESTA_ID}&nullifier=${NULLIFIER}`);
    await page.getByRole("button", { name: "Comprobar" }).click();
    await expect(page.getByText("La votación sigue abierta.")).toBeVisible();
    await expect(page.getByText("No se ha podido comprobar el recibo.")).toHaveCount(0);
  });

  test("/resultados/<id> avisa si los resultados no están disponibles", async ({ page }) => {
    await page.route(`**/api/propuestas/${PROPUESTA_ID}`, (ruta) =>
      ruta.fulfill({
        json: {
          propuesta: { id: PROPUESTA_ID, titulo: "Cerrada", fechaCierre: new Date(0).toISOString() },
          resultados: null,
          resultadosNoDisponibles: true,
        },
      })
    );
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await expect(page.getByText("Los resultados de esta propuesta no están disponibles.")).toBeVisible();
    await expect(page.locator(".page-head p")).toHaveText("Cerrada");
  });

  test("/resultados/<id> muestra el título mientras los resultados están ocultos", async ({ page }) => {
    const cierre = new Date(Date.now() + 86_400_000).toISOString();
    await page.route(`**/api/propuestas/${PROPUESTA_ID}`, (ruta) =>
      ruta.fulfill({
        json: { propuesta: { id: PROPUESTA_ID, titulo: "Abierta", fechaCierre: cierre }, resultados: null },
      })
    );
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await expect(page.getByText("Los resultados se publicarán cuando cierre la votación")).toBeVisible();
    await expect(page.locator(".page-head p")).toHaveText("Abierta");
  });

  test("una propuesta de un contrato anterior (410) avisa al votar y en resultados", async ({ page }) => {
    const mensaje = "Esta propuesta pertenece a una versión anterior de la demostración y ya no admite votos.";
    await page.route(`**/api/propuestas/${PROPUESTA_ID}`, (ruta) =>
      ruta.fulfill({ status: 410, json: { error: mensaje, archivada: true } })
    );
    await page.goto(`/votar/${PROPUESTA_ID}`);
    await expect(page.getByText(mensaje)).toBeVisible();
    await expect(page.getByRole("link", { name: "las propuestas abiertas" })).toHaveAttribute("href", "/propuestas");
    await expect(page.getByText("No se ha podido cargar esta propuesta.")).toHaveCount(0);

    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await expect(page.getByText(mensaje)).toBeVisible();
    await expect(page.getByText("Cargando…")).toHaveCount(0);
  });

  test("/resultados/<id> no se queda en «Cargando…» si la propuesta no existe", async ({ page }) => {
    await page.route(`**/api/propuestas/${PROPUESTA_ID}`, (ruta) => ruta.fulfill({ status: 404, json: {} }));
    await page.goto(`/resultados/${PROPUESTA_ID}`);
    await expect(page.getByText("No se ha podido cargar esta propuesta.")).toBeVisible();
    await expect(page.getByText("Cargando…")).toHaveCount(0);
  });
});
