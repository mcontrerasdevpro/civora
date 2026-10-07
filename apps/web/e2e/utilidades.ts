import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PROPUESTA_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
export const NULLIFIER = "0x5f3c1a2b4d6e8f0a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f2a4b6c8d0e2f4a";
export const MENSAJE_RETO_CADUCADO = "El reto ha caducado o no es válido.";

const JERGA = /\b(nullifiers?|pruebas?|blockchain|hash(es)?|on-chain|contratos?|relayer|criptogr\w*)\b/i;

function propuesta() {
  const ahora = Date.now();
  return {
    schema: "propuesta/v1",
    id: PROPUESTA_ID,
    titulo: "Carril bici en la avenida principal",
    descripcion: "",
    pregunta: "¿Quiere que se construya un carril bici en la avenida principal?",
    opciones: ["a_favor", "en_contra", "abstencion"],
    fechaApertura: new Date(ahora - 86_400_000).toISOString(),
    fechaCierre: new Date(ahora + 86_400_000).toISOString(),
    elegibilidad: {
      requiereEmpadronamiento: true,
      requiereDniEspanol: true,
      anosResidenciaMinimos: 5,
      edadMinima: 18,
    },
  };
}

/**
 * Sustituye Autofirma por una versión que firma al instante y anota qué ha
 * firmado en window.__firmado. Con window.__autofirmaFalla = true, falla
 * como si el usuario cancelara.
 */
const AUTOSCRIPT_FALSO = `
window.__firmado = [];
window.AutoScript = {
  cargarAppAfirma: function () {},
  sign: function (datos, algoritmo, formato, extra, onExito, onError) {
    window.__firmado.push(datos);
    setTimeout(function () {
      if (window.__autofirmaFalla) onError("cancelado", "Operación cancelada por el usuario");
      else onExito("RklSTUE=", "Q0VSVA==");
    }, 10);
  },
};`;

export type OpcionesSimulacion = {
  /** Respuestas sucesivas del envío del voto con certificado. */
  respuestasVoto?: { status: number; body: unknown }[];
};

/**
 * Simula las API que usa el flujo de voto y registra lo que se envía.
 * Devuelve los cuerpos de los votos enviados, el número de retos pedidos y
 * la opción con la que se pidió cada reto.
 */
export async function simularApi(page: Page, opciones: OpcionesSimulacion = {}) {
  const votos: unknown[] = [];
  const contador = { retos: 0 };
  const opcionesReto: unknown[] = [];
  const respuestas = [...(opciones.respuestasVoto ?? [{ status: 200, body: { nullifier: NULLIFIER } }])];

  await page.route(`**/api/propuestas/${PROPUESTA_ID}`, (ruta) =>
    ruta.fulfill({ json: { propuesta: propuesta() } })
  );
  await page.route("**/js/autoscript.js", (ruta) =>
    ruta.fulfill({ contentType: "application/javascript", body: AUTOSCRIPT_FALSO })
  );
  await page.route("**/api/identidad/certificado/reto", (ruta) => {
    contador.retos += 1;
    opcionesReto.push((ruta.request().postDataJSON() as { opcion?: unknown }).opcion);
    return ruta.fulfill({ json: { reto: "ab".repeat(32), timestamp: Date.now() } });
  });
  await page.route("**/api/propuesta/votos/certificado", (ruta) => {
    votos.push(ruta.request().postDataJSON());
    const respuesta = respuestas.length > 1 ? respuestas.shift()! : respuestas[0];
    return ruta.fulfill({ status: respuesta.status, json: respuesta.body });
  });
  // La vía ZK no puede completarse sin la app móvil: se corta la conexión
  // externa para que los tests no dependan de terceros.
  await page.route(/zkpassport\.id/, (ruta) => ruta.abort());

  return { votos, contador, opcionesReto };
}

/**
 * Sustituye speechSynthesis por una versión controlada. `voces` null quita
 * la API por completo; lo leído queda en window.__leido.
 */
export async function simularVoces(
  page: Page,
  voces: { name: string; lang: string; localService: boolean }[] | null
) {
  await page.addInitScript((lista) => {
    const w = window as unknown as Record<string, unknown>;
    if (lista === null) {
      // Navegador sin Web Speech API: la propiedad desaparece por completo.
      delete w.speechSynthesis;
      delete (Window.prototype as unknown as Record<string, unknown>).speechSynthesis;
      return;
    }
    const leido: { texto: string; voz: string | null }[] = [];
    w.__leido = leido;
    class Enunciado {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(texto: string) {
        this.text = texto;
      }
    }
    w.SpeechSynthesisUtterance = Enunciado;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => lista,
        speak: (e: Enunciado) => leido.push({ texto: e.text, voz: (e.voice as { name?: string } | null)?.name ?? null }),
        cancel: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  }, voces);
}

export async function activarModoSencillo(page: Page) {
  const interruptor = page.getByRole("switch", { name: "Modo sencillo" });
  await interruptor.click();
  await expect(interruptor).toHaveAttribute("aria-checked", "true");
}

export async function abrirVotacion(page: Page) {
  await page.goto(`/votar/${PROPUESTA_ID}`);
  await expect(page.locator(".metodo-selector")).toBeVisible();
}

/** Recorre la identificación con certificado hasta la pantalla de elegir. */
export async function identificarseConCertificado(page: Page) {
  await page.locator(".metodo-card").nth(1).click();
  await page.waitForFunction(() => Boolean((window as unknown as { AutoScript?: unknown }).AutoScript));
  await page.locator("#fecha-nacimiento-cert").fill("1980-05-17");
  await page.locator(".form-check input[type=checkbox]").check();
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("fieldset.opciones-fieldset")).toBeVisible();
}

export async function comprobarAccesibilidad(page: Page, contexto: string) {
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const resumen = resultado.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
  );
  expect(resumen, `Infracciones WCAG en ${contexto}`).toEqual([]);
}

/** El texto visible del flujo de voto no debe contener jerga técnica. */
export async function comprobarSinJerga(page: Page, contexto: string) {
  const texto = (await page.locator(".flujo-voto").innerText()).replace(/\s+/g, " ");
  expect(texto.match(JERGA)?.[0] ?? null, `Jerga en ${contexto}: ${texto}`).toBeNull();
}
