import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { datosVinculadosDeVoto } = await import("../../../packages/shared-types/src/index.ts");

// ---------- R-01: la opción va vinculada a la prueba ZK ----------

test("el dato vinculado de la prueba ZK incluye propuesta y opción", () => {
  const propuesta = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  assert.equal(datosVinculadosDeVoto(propuesta, "a_favor"), `civora-voto:${propuesta}:a_favor`);
  assert.equal(datosVinculadosDeVoto(propuesta, "en_contra"), `civora-voto:${propuesta}:en_contra`);
  assert.equal(datosVinculadosDeVoto(propuesta, "abstencion"), `civora-voto:${propuesta}:abstencion`);
  // Cabe en el límite de 500 bytes del custom_data de ZKPassport.
  assert.ok(Buffer.byteLength(datosVinculadosDeVoto(propuesta, "abstencion")) < 500);
});

test("el contrato reconstruye el mismo dato vinculado (VotacionAnonima.datosVinculados)", async () => {
  const fuente = await readFile(
    new URL("../../../packages/contracts/contracts/VotacionAnonima.sol", import.meta.url),
    "utf8"
  );
  assert.match(fuente, /string\.concat\("civora-voto:", propuestaIdTexto, ":", nombre\)/);
  for (const opcion of ["a_favor", "en_contra", "abstencion"]) {
    assert.ok(fuente.includes(`"${opcion}"`), opcion);
  }
});

test("la solicitud a ZKPassport vincula el dato con bind(\"custom_data\")", async () => {
  const fuente = await readFile(new URL("../../../packages/zk-identity/src/index.ts", import.meta.url), "utf8");
  assert.match(fuente, /\.bind\("custom_data", datosVinculadosDeVoto\(propuestaId, opcion\)\)/);
});

// ---------- La prueba va al contrato sin verificación local en el navegador ----------

test("la prueba se envía al llegar (onProofGenerated) y no se sube al panel de ZKPassport", async () => {
  const identidad = await readFile(new URL("../../../packages/zk-identity/src/index.ts", import.meta.url), "utf8");
  assert.match(identidad, /new ZKPassport\(APP_DOMAIN, \{ disableProofStorage: true \}\)/);
  assert.doesNotMatch(identidad, /new ZKPassport\(APP_DOMAIN\)/);

  const flujo = await readFile(new URL("../app/votar/IdentificacionDnie.tsx", import.meta.url), "utf8");
  assert.match(flujo, /solicitud\.onProofGenerated\(/);
  assert.match(flujo, /esPruebaVerificableEnContrato\(proof\)/);
});

test("la CSP no abre WebAssembly ni Alchemy para la verificación local del SDK", async () => {
  const { crearCsp } = await import("../lib/content-security-policy.js");
  const csp = crearCsp("n", "civora.nexuraia.com", "production");
  assert.doesNotMatch(csp, /wasm-unsafe-eval|alchemy\.com|aztec/);
});

// ---------- Logo de la solicitud a ZKPassport ----------

test("el logo de la solicitud a ZKPassport es un PNG servido por la propia web", async () => {
  const identidad = await readFile(new URL("../../../packages/zk-identity/src/index.ts", import.meta.url), "utf8");
  assert.match(identidad, /logo: `https:\/\/\$\{APP_DOMAIN\}\/logo\.png`/);
  assert.doesNotMatch(identidad, /civora\.example/);

  const png = await readFile(new URL("../public/logo.png", import.meta.url));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length < 50_000);
});
