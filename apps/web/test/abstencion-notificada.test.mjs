import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const modulo = fs.readFileSync(path.join(raiz, "lib/abstencion-notificada.ts"), "utf8");
const api = fs.readFileSync(path.join(raiz, "app/api/propuesta/abstenciones/route.ts"), "utf8");
const voto = fs.readFileSync(path.join(raiz, "app/api/propuesta/votos/certificado/route.ts"), "utf8");

test("el registro de abstenci�n guarda HMAC y metadatos, nunca documentos de identidad", () => {
  assert.match(modulo, /derivarNullifierCertificado/);
  assert.match(fs.readFileSync(path.join(raiz, "lib/db.ts"), "utf8"), /UNIQUE \(propuesta_id, nullifier\)/);
  assert.doesNotMatch(modulo, /signatureB64|certB64/);
  const esquema = fs.readFileSync(path.join(raiz, "lib/db.ts"), "utf8").split("let esquemaEventosListo")[0];
  assert.match(esquema, /nullifier TEXT NOT NULL/);
  assert.match(esquema, /UNIQUE \(propuesta_id, nullifier\)/);
  assert.doesNotMatch(esquema, /signatureB64|certB64|nif TEXT|dni TEXT/i);
});

test("la declaraci�n solo se registra despu�s de verificar la firma y un voto previo lo impide", () => {
  assert.ok(api.indexOf("verificarFirmaCertificado") < api.indexOf("registrarAbstencionNotificada"));
  assert.match(api, /VOTO_PREVIO/);
  assert.match(modulo, /nullifierUsado/);
});

test("el voto certificado comparte bloqueo transaccional y respeta abstenci�n previa", () => {
  assert.match(voto, /conIdentidadBloqueada/);
  assert.match(voto, /existeAbstencionNotificada/);
  assert.match(voto, /ABSTENCION_PREVIA/);
});
