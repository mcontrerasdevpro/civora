import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raiz = (ruta) => new URL(`../../../${ruta}`, import.meta.url);

/** Pares "selector: versión" de una sección de primer nivel de un YAML simple. */
function seccionYaml(texto, nombre) {
  const lineas = texto.split(/\r?\n/);
  const inicio = lineas.findIndex((l) => l === `${nombre}:`);
  assert.notEqual(inicio, -1, `falta la sección ${nombre}`);
  const pares = {};
  for (const linea of lineas.slice(inicio + 1)) {
    if (!linea.startsWith("  ")) break;
    const m = /^\s+["']?(.+?)["']?:\s+["']?(.+?)["']?\s*$/.exec(linea);
    if (m) pares[m[1]] = m[2];
  }
  return pares;
}

test("los overrides de package.json (pnpm 9) y pnpm-workspace.yaml (pnpm >= 10) son idénticos", async () => {
  const paquete = JSON.parse(await readFile(raiz("package.json"), "utf8"));
  const espacio = await readFile(raiz("pnpm-workspace.yaml"), "utf8");
  assert.deepEqual(seccionYaml(espacio, "overrides"), paquete.pnpm.overrides);
});

test("el lockfile registra los mismos overrides", async () => {
  const paquete = JSON.parse(await readFile(raiz("package.json"), "utf8"));
  const lockfile = await readFile(raiz("pnpm-lock.yaml"), "utf8");
  assert.deepEqual(seccionYaml(lockfile, "overrides"), paquete.pnpm.overrides);
});

test("el proyecto fija pnpm 9.0.0 y declara allowBuilds para pnpm >= 10.26", async () => {
  const paquete = JSON.parse(await readFile(raiz("package.json"), "utf8"));
  assert.equal(paquete.packageManager, "pnpm@9.0.0");
  const espacio = await readFile(raiz("pnpm-workspace.yaml"), "utf8");
  assert.deepEqual(seccionYaml(espacio, "allowBuilds"), {
    keccak: "false",
    "msgpackr-extract": "false",
    secp256k1: "false",
  });
});
