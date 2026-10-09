import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  permiteVotoCruzado,
  viaParaNuevaPropuesta,
  viaPermitida,
  viasDePropuesta,
  viasHabilitadas,
} from "../lib/vias-voto.mjs";
import { configuracionAlertas, cuerpoAlerta, seudonimoIntento, superaUmbral } from "../lib/alertas-fraude.mjs";

// Hallazgo A-04: con las dos vías abiertas, una persona puede votar dos veces
// (los tests del contrato lo reproducen). Por defecto solo hay una.

test("vías: por defecto solo certificado, sin voto cruzado", () => {
  assert.deepEqual(viasHabilitadas(undefined), ["certificado"]);
  assert.deepEqual(viasHabilitadas(""), ["certificado"]);
  assert.deepEqual(viasHabilitadas("   "), ["certificado"]);
  assert.equal(permiteVotoCruzado(viasHabilitadas(undefined)), false);
  assert.equal(viaPermitida(viasHabilitadas(undefined), "zk"), false);
});

test("vías: se aceptan certificado, zk o las dos, sin distinguir mayúsculas ni espacios", () => {
  assert.deepEqual(viasHabilitadas("zk"), ["zk"]);
  assert.deepEqual(viasHabilitadas(" ZK , certificado "), ["certificado", "zk"]);
  assert.deepEqual(viasHabilitadas("certificado,certificado"), ["certificado"]);
  assert.equal(permiteVotoCruzado(viasHabilitadas("certificado,zk")), true);
});

test("vías: un valor desconocido no abre nada, vuelve a solo certificado", () => {
  for (const valor of ["todas", "certificado,manual", "zk;certificado", "*", ","]) {
    assert.deepEqual(viasHabilitadas(valor), ["certificado"], valor);
  }
});

test("seudónimo: estable, distinto por propuesta y vía, y distinto del nullifier publicado", () => {
  const nullifier = "a".repeat(64);
  const s1 = seudonimoIntento("secreto", "p1", "certificado", nullifier);
  assert.match(s1, /^[0-9a-f]{32}$/);
  assert.equal(s1, seudonimoIntento("secreto", "p1", "certificado", nullifier));
  assert.notEqual(s1, seudonimoIntento("secreto", "p2", "certificado", nullifier));
  assert.notEqual(s1, seudonimoIntento("otro-secreto", "p1", "certificado", nullifier));
  assert.ok(!nullifier.includes(s1));
  // Sin nullifier (ZK rechazado o vía no permitida): agregado por vía.
  assert.equal(seudonimoIntento("secreto", "p1", "zk", null), "zk:agregado");
});

test("configuración de alertas: 3 intentos en 24 h por defecto; webhook solo https", () => {
  assert.deepEqual(configuracionAlertas({}), { umbral: 3, ventanaHoras: 24, webhook: null, token: null });
  const conf = configuracionAlertas({
    ALERTA_FRAUDE_UMBRAL: "5",
    ALERTA_FRAUDE_VENTANA_HORAS: "1",
    ALERTA_FRAUDE_WEBHOOK_URL: "https://n8n.example/webhook/x",
    ALERTA_FRAUDE_WEBHOOK_TOKEN: "t",
  });
  assert.deepEqual(conf, { umbral: 5, ventanaHoras: 1, webhook: "https://n8n.example/webhook/x", token: "t" });
  assert.equal(configuracionAlertas({ ALERTA_FRAUDE_WEBHOOK_URL: "http://n8n.example/x" }).webhook, null);
  assert.equal(configuracionAlertas({ ALERTA_FRAUDE_WEBHOOK_URL: "no es una url" }).webhook, null);
  // Un umbral de 1 alertaría con el primer error legítimo; el mínimo es 2.
  assert.equal(configuracionAlertas({ ALERTA_FRAUDE_UMBRAL: "1" }).umbral, 3);
  assert.equal(configuracionAlertas({ ALERTA_FRAUDE_UMBRAL: "0x10" }).umbral, 3);
});

test("umbral: alerta al llegar, no antes", () => {
  assert.equal(superaUmbral(2, 3), false);
  assert.equal(superaUmbral(3, 3), true);
  assert.equal(superaUmbral(4, 3), true);
});

test("la alerta solo lleva campos fijos: nunca opción, NIF, nullifier ni IP", () => {
  const cuerpo = cuerpoAlerta({
    propuestaId: "p1",
    via: "certificado",
    motivo: "voto-repetido",
    intentos: 3,
    ventanaHoras: 24,
    seudonimo: "0123456789abcdef0123456789abcdef",
  });
  assert.deepEqual(Object.keys(cuerpo).sort(), [
    "intentos",
    "motivo",
    "propuestaId",
    "seudonimo",
    "tipo",
    "ventanaHoras",
    "via",
  ]);
});

test("las rutas de voto comprueban la vía y registran los intentos repetidos", async () => {
  for (const [ruta, via] of [
    ["app/api/propuesta/votos/certificado/route.ts", "certificado"],
    ["app/api/propuesta/votos/zk/route.ts", "zk"],
  ]) {
    const fuente = await readFile(new URL(`../${ruta}`, import.meta.url), "utf8");
    assert.ok(fuente.includes(`viaPermitida(await viasPermitidasDe(propuestaId), "${via}")`), ruta);
    assert.match(fuente, /motivo: "via-no-permitida"/, ruta);
    assert.match(fuente, /motivo: "voto-repetido"/, ruta);
  }
  const certificado = await readFile(new URL("../app/api/propuesta/votos/certificado/route.ts", import.meta.url), "utf8");
  assert.match(certificado, /intentosBloqueados\(/);
});

test("vía de la propuesta: la fijada en el contrato, si sigue habilitada", () => {
  assert.deepEqual(viasDePropuesta("certificado", ["certificado", "zk"]), ["certificado"]);
  assert.deepEqual(viasDePropuesta("zk", ["certificado", "zk"]), ["zk"]);
  // Vía deshabilitada después de crearla: no se ofrece ninguna.
  assert.deepEqual(viasDePropuesta("zk", ["certificado"]), []);
  // Propuesta anterior sin vía guardada: solo las habilitadas.
  assert.deepEqual(viasDePropuesta(null, ["certificado"]), ["certificado"]);
});

test("vía de una propuesta nueva: la pedida si está habilitada; si no se pide, la primera", () => {
  assert.equal(viaParaNuevaPropuesta(undefined, ["certificado"]), "certificado");
  assert.equal(viaParaNuevaPropuesta(undefined, ["zk"]), "zk");
  assert.equal(viaParaNuevaPropuesta("zk", ["certificado", "zk"]), "zk");
  assert.equal(viaParaNuevaPropuesta("zk", ["certificado"]), null);
});
