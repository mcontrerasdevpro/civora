import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { codigoDeError, registrarError } from "../lib/registro.mjs";
import { segmentoFinal } from "../lib/parametros-ruta.mjs";

const require = createRequire(import.meta.url);
const { validarEntorno } = require("../lib/validar-entorno.js");
const DIRECTORIO_WEB = fileURLToPath(new URL("..", import.meta.url));
const NULLIFIER = "0x5f3c1a2b4d6e8f0a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f2a4b6c8d0e2f4a";

// ---------- Registro sin datos ----------

test("codigoDeError solo devuelve códigos cortos, nunca mensajes ni datos", () => {
  // Forma de un error de ethers: el mensaje y `info` llevan la petición RPC con el nullifier.
  const errorEthers = Object.assign(new Error(`could not coalesce error (topics: ["0xabc", "${NULLIFIER}"])`), {
    code: "UNKNOWN_ERROR",
    info: { payload: { method: "eth_getLogs", params: [{ topics: [NULLIFIER] }] } },
  });
  assert.equal(codigoDeError(errorEthers), "UNKNOWN_ERROR");
  assert.equal(codigoDeError(new TypeError("fallo con 12345678Z")), "TypeError");
  assert.equal(codigoDeError({ code: `datos ${NULLIFIER}` }), "ERROR_DESCONOCIDO");
  assert.equal(codigoDeError("cadena con 12345678Z"), "ERROR_DESCONOCIDO");
  assert.equal(codigoDeError(null), "ERROR_DESCONOCIDO");
});

test("registrarError escribe una sola línea sin el contenido del error", () => {
  const lineas = [];
  const original = console.error;
  console.error = (...args) => lineas.push(args.map(String).join(" "));
  try {
    registrarError("consulta de recibo fallida", Object.assign(new Error(NULLIFIER), { code: "CALL_EXCEPTION" }));
  } finally {
    console.error = original;
  }
  assert.deepEqual(lineas, ["[civora] consulta de recibo fallida: CALL_EXCEPTION"]);
});

async function archivosDeCodigo(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true, recursive: true });
  return entradas
    .filter((e) => e.isFile() && /\.(ts|tsx|js|mjs)$/.test(e.name) && !e.name.endsWith(".d.ts"))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));
}

test("en el servidor solo lib/registro.mjs escribe en la consola", async () => {
  const archivos = [
    ...(await archivosDeCodigo(path.join(DIRECTORIO_WEB, "app", "api"))),
    ...(await archivosDeCodigo(path.join(DIRECTORIO_WEB, "lib"))),
    path.join(DIRECTORIO_WEB, "middleware.ts"),
  ].filter((archivo) => !archivo.endsWith(path.join("lib", "registro.mjs")));

  const infractores = [];
  for (const archivo of archivos) {
    const fuente = await readFile(archivo, "utf8");
    fuente.split("\n").forEach((linea, i) => {
      if (/console\.\w+\s*\(/.test(linea) && !linea.trim().startsWith("//")) {
        infractores.push(`${path.relative(DIRECTORIO_WEB, archivo)}:${i + 1}`);
      }
    });
  }
  assert.deepEqual(infractores, []);
});

test("las rutas API no relanzan errores (Next los registraría enteros) ni leen IPs", async () => {
  for (const archivo of await archivosDeCodigo(path.join(DIRECTORIO_WEB, "app", "api"))) {
    const fuente = await readFile(archivo, "utf8");
    const relativo = path.relative(DIRECTORIO_WEB, archivo);
    assert.doesNotMatch(fuente, /^\s*throw error;/m, relativo);
    // La única lectura de IP permitida es la del rate limit de creación de propuestas.
    if (!relativo.endsWith(path.join("api", "propuestas", "route.ts"))) {
      assert.doesNotMatch(fuente, /x-forwarded-for|x-real-ip|request\.ip/i, relativo);
    }
  }
});

// ---------- Parámetros de rutas dinámicas (Next 14 y 15) ----------

test("segmentoFinal lee el parámetro dinámico de la URL", () => {
  assert.equal(segmentoFinal(new Request(`http://x/api/propuesta/votos/${NULLIFIER}?propuestaId=p`)), NULLIFIER);
  assert.equal(segmentoFinal(new Request("http://x/api/propuestas/6f1c2b3a-4d5e")), "6f1c2b3a-4d5e");
  assert.equal(segmentoFinal(new Request("http://x/api/propuestas/a%20b/")), "a b");
  assert.equal(segmentoFinal(new Request("http://x/api/propuestas/%E0%A4%A")), "%E0%A4%A");
});

test("ninguna ruta ni página usa la prop params (síncrona en 14, promesa en 15)", async () => {
  const archivos = await archivosDeCodigo(path.join(DIRECTORIO_WEB, "app"));
  for (const archivo of archivos.filter((a) => a.includes("["))) {
    const fuente = await readFile(archivo, "utf8");
    assert.doesNotMatch(fuente, /\{\s*params\s*\}/, path.relative(DIRECTORIO_WEB, archivo));
  }
});

// ---------- Validaciones de arranque compartidas ----------

test("validarEntorno aplica las tres validaciones de arranque", () => {
  const publico = {
    HARDHAT_RPC_URL: "https://rpc.sepolia.org",
    NODE_ENV: "production",
    NEXT_PUBLIC_ZKPASSPORT_DOMAIN: "civora.nexuraia.com",
    NEXT_PUBLIC_ZKPASSPORT_DEV_MODE: "false",
    NULLIFIER_CERTIFICADO_SECRET: "s".repeat(48),
  };
  assert.doesNotThrow(() => validarEntorno(publico));
  assert.doesNotThrow(() => validarEntorno({}));
  assert.throws(() => validarEntorno({ ...publico, NULLIFIER_CERTIFICADO_SECRET: undefined }), /NULLIFIER/);
  assert.throws(() => validarEntorno({ ...publico, FALLO_ABIERTO_REVOCACION: "true" }), /FALLO_ABIERTO/);
  assert.throws(() => validarEntorno({ ...publico, NEXT_PUBLIC_ZKPASSPORT_DEV_MODE: "true" }), /DEV_MODE/);
  assert.doesNotThrow(() =>
    validarEntorno({
      ...publico,
      NEXT_PUBLIC_ZKPASSPORT_DEV_MODE: "true",
      CIVORA_DEMO_TESTNET: "true",
    })
  );
});

test("arranque.js (entrada de la imagen) termina con código 1 si la configuración no es válida", () => {
  const resultado = spawnSync(process.execPath, ["arranque.js"], {
    cwd: DIRECTORIO_WEB,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      NODE_ENV: "production",
      HARDHAT_RPC_URL: "https://rpc.sepolia.org",
      NEXT_PUBLIC_ZKPASSPORT_DOMAIN: "civora.nexuraia.com",
      NEXT_PUBLIC_ZKPASSPORT_DEV_MODE: "false",
    },
    encoding: "utf8",
  });
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /configuración no válida: .*NULLIFIER_CERTIFICADO_SECRET/);
});
