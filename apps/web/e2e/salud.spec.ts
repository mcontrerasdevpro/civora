import { expect, test } from "@playwright/test";

test("GET /api/salud responde 200 sin datos sensibles ni caché", async ({ request }) => {
  const respuesta = await request.get("/api/salud");
  expect(respuesta.status()).toBe(200);
  expect(await respuesta.json()).toEqual({ estado: "ok" });
  expect(respuesta.headers()["cache-control"]).toContain("no-store");
});
