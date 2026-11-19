import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BYTES_MAXIMOS,
  MINUTOS_CADUCIDAD,
  RESPUESTAS,
  caducidad,
  interpretarPeticion,
  unirParametros,
} from "../lib/servidor-intermedio.mjs";

const ID = "a1B2c3D4e5F6g7H8i9J0";
const p = (texto) => new URLSearchParams(texto);

test("op=check responde OK en los dos servicios", () => {
  assert.deepEqual(interpretarPeticion(p("op=check"), "almacen"), { tipo: "check" });
  assert.deepEqual(interpretarPeticion(p("op=check"), "recuperacion"), { tipo: "check" });
});

test("acepta put en el almacén y get en la recuperación", () => {
  assert.deepEqual(interpretarPeticion(p(`op=put&v=1_0&id=${ID}&dat=abc-_.=`), "almacen"), {
    tipo: "put",
    id: ID,
    datos: "abc-_.=",
  });
  assert.deepEqual(interpretarPeticion(p(`op=get&v=1_0&id=${ID}&it=3`), "recuperacion"), { tipo: "get", id: ID });
});

test("cada servicio rechaza la operación del otro", () => {
  assert.equal(interpretarPeticion(p(`op=get&v=1_0&id=${ID}`), "almacen").respuesta, RESPUESTAS.operacion);
  assert.equal(interpretarPeticion(p(`op=put&v=1_0&id=${ID}&dat=x`), "recuperacion").respuesta, RESPUESTAS.operacion);
});

test("rechaza peticiones incompletas, de otra versión o con id no válido", () => {
  assert.equal(interpretarPeticion(p(""), "almacen").respuesta, RESPUESTAS.sinOperacion);
  assert.equal(interpretarPeticion(p(`op=put&id=${ID}&dat=x`), "almacen").respuesta, RESPUESTAS.sinParametros);
  assert.equal(interpretarPeticion(p(`op=put&v=1_0&id=${ID}`), "almacen").respuesta, RESPUESTAS.sinParametros);
  assert.equal(interpretarPeticion(p(`op=put&v=2_0&id=${ID}&dat=x`), "almacen").respuesta, RESPUESTAS.version);
  for (const id of ["corto", "con espacio aaaaaaa", "../../etc/passwd", "a".repeat(65)]) {
    assert.equal(interpretarPeticion(p(`op=get&v=1_0&id=${encodeURIComponent(id)}`), "recuperacion").respuesta, RESPUESTAS.sinParametros);
  }
});

test("rechaza datos por encima del tamaño máximo", () => {
  const grande = "a".repeat(BYTES_MAXIMOS + 1);
  assert.equal(interpretarPeticion(p(`op=put&v=1_0&id=${ID}&dat=${grande}`), "almacen").respuesta, RESPUESTAS.demasiadoGrande);
});

test("ERR-06 es la respuesta con la que autoscript.js sigue esperando", async () => {
  assert.equal(RESPUESTAS.noExiste.slice(0, 6).toLowerCase(), "err-06");
  // El resto de errores deben tener la forma ERR-xx:= para que el script los muestre y pare.
  for (const [clave, texto] of Object.entries(RESPUESTAS)) {
    if (clave !== "ok") assert.match(texto, /^ERR-\d\d:=/);
  }
  const script = await readFile(new URL("../public/js/autoscript.js", import.meta.url), "utf8");
  assert.ok(script.includes('html.substring(0, 6).toLowerCase() == "err-06"'));
  assert.ok(script.includes('"/afirma-signature-storage/StorageService"'));
  assert.ok(script.includes('"/afirma-signature-retriever/RetrieveService"'));
});

test("los parámetros del cuerpo se unen a los de la URL y prevalecen", () => {
  const parametros = unirParametros(`https://civora.test/afirma-signature-storage/StorageService?op=check&v=0`, `op=put&v=1_0&id=${ID}&dat=x`);
  assert.equal(parametros.get("op"), "put");
  assert.equal(parametros.get("v"), "1_0");
  assert.equal(parametros.get("dat"), "x");
});

test("los datos caducan a los pocos minutos", () => {
  const ahora = new Date("2026-11-19T10:00:00Z");
  assert.equal(caducidad(ahora).getTime() - ahora.getTime(), MINUTOS_CADUCIDAD * 60_000);
  assert.ok(MINUTOS_CADUCIDAD <= 10);
});

test("las rutas existen donde autoscript.js las busca y no registran datos", async () => {
  for (const ruta of [
    "../app/afirma-signature-storage/StorageService/route.ts",
    "../app/afirma-signature-retriever/RetrieveService/route.ts",
  ]) {
    const codigo = await readFile(new URL(ruta, import.meta.url), "utf8");
    assert.match(codigo, /export function GET/);
    assert.match(codigo, /export function POST/);
  }
  const almacen = await readFile(new URL("../lib/servidor-intermedio-store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(almacen, /console\./);
  assert.match(almacen, /DELETE FROM servidor_intermedio WHERE id = \$1 AND caduca > now\(\) RETURNING datos/);
});

test("autoscript.js lleva el parche de Civora que no pide cifrar en Android (ADR 0025)", async () => {
  const script = await readFile(new URL("../public/js/autoscript.js", import.meta.url), "utf8");
  assert.equal(script.match(/CIVORA \(ADR 0025\)/g)?.length, 2);
  assert.ok(script.includes("var sinCifradoCivora = Platform.isAndroid();"));
  assert.ok(script.includes("if (!cipherConfig && !sinCifradoCivora) {"));
});
