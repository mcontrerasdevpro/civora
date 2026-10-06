import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  AUDIO_CONFIRMACION,
  CLAVE_MODO_SENCILLO,
  MENSAJE_RETO_CADUCADO,
  contieneJerga,
  elegirVozLocal,
  esRetoCaducado,
  guardarModoSencillo,
  leerModoSencillo,
  mensajeParaVotante,
} from "../lib/modo-sencillo.mjs";

function almacenEnMemoria() {
  const datos = new Map();
  return {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
    datos,
  };
}

test("recuerda y olvida el modo sencillo en el almacenamiento", () => {
  const almacen = almacenEnMemoria();
  assert.equal(leerModoSencillo(() => almacen), false);
  assert.equal(guardarModoSencillo(() => almacen, true), true);
  assert.equal(almacen.datos.get(CLAVE_MODO_SENCILLO), "1");
  assert.equal(leerModoSencillo(() => almacen), true);
  assert.equal(guardarModoSencillo(() => almacen, false), true);
  assert.equal(leerModoSencillo(() => almacen), false);
});

test("no rompe si el almacenamiento falta o lanza", () => {
  const lanza = () => {
    throw new Error("SecurityError");
  };
  assert.equal(leerModoSencillo(lanza), false);
  assert.equal(guardarModoSencillo(lanza, true), false);
  assert.equal(leerModoSencillo(() => null), false);
  assert.equal(guardarModoSencillo(() => undefined, true), false);
  const setItemLanza = { ...almacenEnMemoria(), setItem: lanza };
  assert.equal(guardarModoSencillo(() => setItemLanza, true), false);
});

test("elige solo voces locales y prefiere es-ES", () => {
  const enRed = { name: "Google español", lang: "es-ES", localService: false };
  const mexicana = { name: "Sabina", lang: "es-MX", localService: true };
  const espanola = { name: "Helena", lang: "es_ES", localService: true };
  const inglesa = { name: "Zira", lang: "en-US", localService: true };

  assert.equal(elegirVozLocal([enRed, mexicana, espanola, inglesa]), espanola);
  assert.equal(elegirVozLocal([enRed, mexicana, inglesa]), mexicana);
  assert.equal(elegirVozLocal([enRed, inglesa]), null);
  assert.equal(elegirVozLocal([]), null);
});

test("detecta jerga técnica sin confundir palabras comunes", () => {
  for (const texto of [
    "Guarda tu nullifier",
    "Se genera una prueba criptográfica",
    "registrado en blockchain",
    "el hash del contenido",
    "verificada dentro del contrato",
  ]) {
    assert.equal(contieneJerga(texto), true, texto);
  }
  for (const texto of ["Comprueba tu voto", "Va a votar: A favor. ¿Es correcto?", "Pida ayuda"]) {
    assert.equal(contieneJerga(texto), false, texto);
  }
});

test("sustituye mensajes técnicos solo en modo sencillo", () => {
  const generico = "No se ha podido guardar su voto.";
  assert.equal(mensajeParaVotante("Nullifier ya usado", true, generico), generico);
  assert.equal(mensajeParaVotante("Nullifier ya usado", false, generico), "Nullifier ya usado");
  assert.equal(mensajeParaVotante("Propuesta inexistente.", true, generico), "Propuesta inexistente.");
});

test("reconoce el reto caducado con el mismo texto que usa el servidor", async () => {
  const servidor = await readFile(new URL("../lib/certificado-digital.ts", import.meta.url), "utf8");
  assert.ok(servidor.includes(`"${MENSAJE_RETO_CADUCADO}"`));
  assert.equal(esRetoCaducado(MENSAJE_RETO_CADUCADO), true);
  assert.equal(esRetoCaducado("La firma no cubre el reto esperado."), false);
  assert.equal(esRetoCaducado(null), false);
});

test("hay un audio de confirmación propio por cada opción de voto", async () => {
  assert.deepEqual(Object.keys(AUDIO_CONFIRMACION).sort(), ["a_favor", "abstencion", "en_contra"]);
  for (const ruta of Object.values(AUDIO_CONFIRMACION)) {
    assert.match(ruta, /^\/audio\/confirmacion\/[a-z_]+\.wav$/);
    const archivo = await stat(new URL(`../public${ruta}`, import.meta.url));
    assert.ok(archivo.size > 1000, ruta);
  }
});
