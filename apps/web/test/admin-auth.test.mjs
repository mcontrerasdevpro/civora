import assert from "node:assert/strict";
import test from "node:test";
import { adminSecretMatches, checkAdminRateLimit } from "../lib/admin-auth.mjs";
import { resultadosVisibles } from "../lib/resultados-visibles.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { crearCsp } = require("../lib/content-security-policy.js");
const { isLocalRpcUrl, validarConfiguracionZkWeb, validarFalloAbiertoRevocacion } = require("../lib/runtime-security.js");
const { nifDeCertificado } = await import("../lib/nif-certificado.mjs");

test("compara claves de administrador y rechaza configuración ausente", () => {
  assert.equal(adminSecretMatches("correcta", "correcta"), true);
  assert.equal(adminSecretMatches("incorrecta", "correcta"), false);
  assert.equal(adminSecretMatches("correcta", undefined), false);
});

test("limita a cinco intentos por clave en una ventana de quince minutos", () => {
  const clave = `test-${crypto.randomUUID()}`;
  for (let intento = 0; intento < 5; intento += 1) {
    assert.equal(checkAdminRateLimit(clave, 1000 + intento).allowed, true);
  }
  const bloqueada = checkAdminRateLimit(clave, 1005);
  assert.equal(bloqueada.allowed, false);
  assert.ok(bloqueada.retryAfterSeconds > 0);
  assert.equal(checkAdminRateLimit(clave, 901001).allowed, true);
});

test("solo hace visibles los resultados al alcanzar la fecha de cierre", () => {
  const cierre = "2026-10-05T12:00:00.000Z";
  const timestamp = Date.parse(cierre);

  assert.equal(resultadosVisibles(cierre, timestamp - 1), false);
  assert.equal(resultadosVisibles(cierre, timestamp), true);
  assert.equal(resultadosVisibles("fecha inválida", timestamp), false);
});

test("permite fallo abierto OCSP solo en producción local y rechaza NIF ausente vía helper", () => {
  assert.equal(isLocalRpcUrl("http://127.0.0.1:8545"), true);
  assert.equal(isLocalRpcUrl("https://rpc.sepolia.org"), false);
  assert.doesNotThrow(() => validarFalloAbiertoRevocacion(true, "http://localhost:8545", "production"));
  assert.throws(
    () => validarFalloAbiertoRevocacion(true, "https://rpc.sepolia.org", "production"),
    /no está permitido/
  );
  assert.doesNotThrow(() => validarFalloAbiertoRevocacion(true, "https://rpc.sepolia.org", "development"));
});

test("exige dominio propio y modo no demo explícito en la web pública", () => {
  assert.throws(
    () => validarConfiguracionZkWeb(undefined, "false", "https://rpc.sepolia.org", "production"),
    /dominio propio/
  );
  assert.throws(
    () => validarConfiguracionZkWeb("votos.ejemplo.es", undefined, "https://rpc.sepolia.org", "production"),
    /DEV_MODE=false/
  );
  assert.doesNotThrow(() =>
    validarConfiguracionZkWeb("votos.ejemplo.es", "false", "https://rpc.sepolia.org", "production")
  );
  assert.doesNotThrow(() => validarConfiguracionZkWeb(undefined, undefined, undefined, "development"));
});

test("genera CSP con nonce, strict-dynamic y sin ejecución inline insegura", () => {
  const csp = crearCsp("nonce-de-prueba", "votos.ejemplo.es");

  assert.match(csp, /script-src 'self' 'nonce-nonce-de-prueba' 'strict-dynamic'/);
  assert.match(csp, /connect-src[^;]*https:\/\/votos\.ejemplo\.es/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /media-src 'self'(;|$)/);
});

test("rechaza implícitamente certificados sin NIF en vez de usar emisor y serie", () => {
  const sinNif = {
    subject: { getField: () => null },
  };
  const conNif = {
    subject: {
      getField: ({ shortName }) => (shortName === "serialNumber" ? { value: "12345678Z" } : null),
    },
  };

  assert.equal(nifDeCertificado(sinNif), null);
  assert.equal(nifDeCertificado(conNif), "12345678Z");
});