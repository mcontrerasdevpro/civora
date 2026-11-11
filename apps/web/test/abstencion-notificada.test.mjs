import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const modulo = fs.readFileSync(path.join(raiz, "lib/abstencion-notificada.ts"), "utf8");
const api = fs.readFileSync(path.join(raiz, "app/api/propuesta/abstenciones/route.ts"), "utf8");
const voto = fs.readFileSync(path.join(raiz, "app/api/propuesta/votos/certificado/route.ts"), "utf8");

test("el registro de abstención guarda HMAC y metadatos, nunca documentos de identidad", () => {
  assert.match(modulo, /derivarNullifierCertificado/);
  assert.match(fs.readFileSync(path.join(raiz, "lib/db.ts"), "utf8"), /UNIQUE \(propuesta_id, nullifier\)/);
  assert.doesNotMatch(modulo, /signatureB64|certB64/);
  const esquema = fs.readFileSync(path.join(raiz, "lib/db.ts"), "utf8").split("let esquemaEventosListo")[0];
  assert.match(esquema, /nullifier TEXT NOT NULL/);
  assert.match(esquema, /UNIQUE \(propuesta_id, nullifier\)/);
  assert.doesNotMatch(esquema, /signatureB64|certB64|nif TEXT|dni TEXT/i);
});

test("la declaración solo se registra después de verificar la firma y un voto previo lo impide", () => {
  assert.ok(api.indexOf("verificarFirmaCertificado") < api.indexOf("registrarAbstencionNotificada"));
  assert.match(api, /VOTO_PREVIO/);
  assert.match(modulo, /nullifierUsado/);
});

test("el voto certificado comparte bloqueo transaccional y respeta abstención previa", () => {
  assert.match(voto, /conIdentidadBloqueada/);
  assert.match(voto, /existeAbstencionNotificada/);
  assert.match(voto, /ABSTENCION_PREVIA/);
});

test("la abstención solo se admite en el periodo de votación y con la vía de certificado", async () => {
  const { motivoRechazoAbstencion } = await import("../lib/contexto-abstencion.mjs");
  const propuesta = { fechaApertura: "2026-01-01T10:00:00.000Z", fechaCierre: "2026-01-02T10:00:00.000Z" };
  const durante = Date.parse("2026-01-01T12:00:00.000Z");
  assert.equal(motivoRechazoAbstencion(propuesta, ["certificado"], durante), null);
  assert.equal(motivoRechazoAbstencion(propuesta, ["zk", "certificado"], durante), null);
  assert.equal(motivoRechazoAbstencion(propuesta, ["certificado"], Date.parse("2026-01-01T09:59:59.000Z")), "no-abierta");
  assert.equal(motivoRechazoAbstencion(propuesta, ["certificado"], Date.parse("2026-01-02T10:00:00.000Z")), "cerrada");
  assert.equal(motivoRechazoAbstencion(propuesta, ["zk"], durante), "via-no-permitida");
});

test("la API de abstención valida periodo y vía antes de verificar la firma", () => {
  assert.match(api, /motivoRechazoAbstencion/);
  assert.match(api, /viasPermitidasDe/);
  assert.ok(api.indexOf("motivoRechazoAbstencion(") < api.indexOf("verificarFirmaCertificado("));
});

test("la declaración firmada prohíbe usar la abstención para votar en nombre del titular", async () => {
  const textos = await import("../lib/texto-abstencion.mjs");
  const { TEXTO_DECLARACION_ABSTENCION, contextoFirmaAbstencion } = await import("../lib/contexto-abstencion.mjs");
  assert.equal(TEXTO_DECLARACION_ABSTENCION, textos.TEXTO_DECLARACION_ABSTENCION);
  assert.match(TEXTO_DECLARACION_ABSTENCION, /^Manifiesto que no ejerceré mi voto en esta votación y no se podrá usar mi abstención/);
  assert.match(TEXTO_DECLARACION_ABSTENCION, /otra persona en mi nombre bajo ningún concepto\.$/);
  assert.notEqual(textos.TEXTO_DECLARACION_ABSTENCION_V1, TEXTO_DECLARACION_ABSTENCION);
  assert.doesNotMatch(textos.TEXTO_DECLARACION_ABSTENCION_V1, /'/);
  const propuesta = { id: "p", titulo: "t", pregunta: "q", fechaApertura: "a", fechaCierre: "c" };
  assert.match(contextoFirmaAbstencion(propuesta), /^abstencion:0x[0-9a-f]{64}$/);
  assert.match(modulo, /texto_declaracion/);
});
