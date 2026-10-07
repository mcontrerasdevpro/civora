import { expect, test } from "@playwright/test";

test("GET /api/salud responde 200 sin datos sensibles ni caché", async ({ request }) => {
  const respuesta = await request.get("/api/salud");
  expect(respuesta.status()).toBe(200);
  expect(await respuesta.json()).toEqual({ estado: "ok" });
  expect(respuesta.headers()["cache-control"]).toContain("no-store");
});

test("la API de optimización de imágenes está desactivada (images.unoptimized)", async ({ page, request }) => {
  const optimizador = await request.get("/_next/image?url=%2Fimages%2Fcivora-hero-bg.webp&w=640&q=75");
  expect(optimizador.status()).toBe(404);

  await page.goto("/");
  await expect(page.locator("img.hero-bg-img")).toHaveAttribute("src", "/images/civora-hero-bg.webp");
  const original = await request.get("/images/civora-hero-bg.webp");
  expect(original.status()).toBe(200);
});
