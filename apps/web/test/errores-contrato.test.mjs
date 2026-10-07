import assert from "node:assert/strict";
import test from "node:test";
import { esPropuestaVigente, esRechazoDelContrato, selectorDeRevert } from "../lib/errores-contrato.mjs";

const ACTUAL = "0xe5B87219E2dda01c61f8491Cc6AcEd5dD85C1Ed6";

test("solo son vigentes las propuestas del contrato actual (o sin contrato guardado)", () => {
  assert.equal(esPropuestaVigente(ACTUAL, ACTUAL), true);
  assert.equal(esPropuestaVigente(ACTUAL.toLowerCase(), ACTUAL), true);
  assert.equal(esPropuestaVigente(null, ACTUAL), true);
  assert.equal(esPropuestaVigente(undefined, ACTUAL), true);
  assert.equal(esPropuestaVigente("0x628901F7bC5Ab55c8b6289a05F0AD543DA94Bdb7", ACTUAL), false);
});

test("distingue un revert del contrato de un fallo de red", () => {
  assert.equal(esRechazoDelContrato({ code: "CALL_EXCEPTION" }), true);
  assert.equal(esRechazoDelContrato({ code: "NETWORK_ERROR" }), false);
  assert.equal(esRechazoDelContrato(new Error("x")), false);
  assert.equal(esRechazoDelContrato(null), false);
});

test("extrae solo el selector de 4 bytes del error, nunca los datos", () => {
  const datos = "0x1234abcd" + "00".repeat(64);
  assert.equal(selectorDeRevert({ data: datos }), "0x1234abcd");
  assert.equal(selectorDeRevert({ info: { error: { data: datos } } }), "0x1234abcd");
  assert.equal(selectorDeRevert({ info: { error: { data: { data: "0xDEADBEEF" } } } }), "0xdeadbeef");
  assert.equal(selectorDeRevert({ error: { data: "0xcafebabe" } }), "0xcafebabe");
  assert.equal(selectorDeRevert({ data: "0x12" }), null);
  assert.equal(selectorDeRevert({}), null);
  assert.equal(selectorDeRevert("0x1234abcd"), null);
});
