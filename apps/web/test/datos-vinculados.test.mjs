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
