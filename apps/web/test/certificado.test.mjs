import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { nifDeCertificado, normalizarDniCertificado } from "../lib/nif-certificado.mjs";
import {
  SECRETO_NULLIFIER_DESARROLLO,
  derivarNullifierCertificado,
  secretoNullifierCertificado,
} from "../lib/nullifier-certificado.mjs";

const require = createRequire(import.meta.url);
const forge = require("node-forge");
const { validarSecretoNullifierCertificado } = require("../lib/runtime-security.js");

process.env.RETO_CERTIFICADO_SECRET = "secreto-de-reto-solo-para-tests";
const { generarReto, verificarFirmaCertificado } = await import("../lib/certificado-digital.ts");

const PROPUESTA = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const SECRETO = "s".repeat(48);
const RPC_PUBLICO = "https://rpc.sepolia.org";

// ---------- R-03: normalización del DNI del certificado ----------

test("normaliza a 8 cifras + letra los formatos de serialNumber documentados", () => {
  for (const formato of [
    "12345678Z",
    "IDCES-12345678Z",
    "idces-12345678z",
    "PNOES-12345678Z",
    "TINES-12345678Z",
    "NIF:12345678-Z",
    "NIF 12.345.678-Z",
    " 12345678 Z ",
  ]) {
    assert.equal(normalizarDniCertificado(formato), "12345678Z", formato);
  }
});

test("rechaza letra de control incorrecta, NIE y formatos que no son DNI", () => {
  for (const formato of [
    "12345678A",
    "IDCES-12345678A",
    "X1234567L",
    "IDCES-X1234567L",
    "1234567Z",
    "123456789Z",
    "B12345678",
    "IDCFR-12345678Z",
    "",
    null,
    undefined,
  ]) {
    assert.equal(normalizarDniCertificado(formato), null, String(formato));
  }
});

test("nifDeCertificado devuelve el DNI canónico o null", () => {
  const conCampo = (valor) => ({
    subject: { getField: ({ shortName }) => (shortName === "serialNumber" ? { value: valor } : null) },
  });
  assert.equal(nifDeCertificado(conCampo("IDCES-12345678Z")), "12345678Z");
  assert.equal(nifDeCertificado(conCampo("IDCES-12345678A")), null);
  assert.equal(nifDeCertificado({ subject: { getField: () => null } }), null);
});

// ---------- R-02: nullifier con HMAC y secreto obligatorio ----------

test("varios formatos del mismo DNI producen el mismo nullifier", () => {
  const nullifiers = new Set(
    ["12345678Z", "IDCES-12345678Z", "NIF:12345678-Z", "idces-12345678z"].map((formato) =>
      derivarNullifierCertificado(PROPUESTA, normalizarDniCertificado(formato), SECRETO)
    )
  );
  assert.equal(nullifiers.size, 1);
  assert.match([...nullifiers][0], /^[0-9a-f]{64}$/);
});

test("el nullifier depende del secreto y de la propuesta, y no es un hash enumerable", () => {
  const nullifier = derivarNullifierCertificado(PROPUESTA, "12345678Z", SECRETO);
  assert.notEqual(nullifier, derivarNullifierCertificado(PROPUESTA, "12345678Z", "t".repeat(48)));
  assert.notEqual(nullifier, derivarNullifierCertificado("otra-propuesta", "12345678Z", SECRETO));

  // Lo que hacía antes (y cualquier hash sin secreto) se puede recalcular enumerando DNI.
  for (const sinSecreto of [`${PROPUESTA}:certificado:12345678Z`, `${PROPUESTA}:12345678Z`]) {
    assert.notEqual(nullifier, createHash("sha256").update(sinSecreto).digest("hex"));
  }
});

test("el valor fijo de desarrollo solo se usa con un RPC local", () => {
  assert.equal(secretoNullifierCertificado({}), SECRETO_NULLIFIER_DESARROLLO);
  assert.equal(secretoNullifierCertificado({ HARDHAT_RPC_URL: "http://127.0.0.1:8545" }), SECRETO_NULLIFIER_DESARROLLO);
  assert.equal(
    secretoNullifierCertificado({ HARDHAT_RPC_URL: RPC_PUBLICO, NULLIFIER_CERTIFICADO_SECRET: SECRETO }),
    SECRETO
  );
  // Aunque NODE_ENV sea development, un RPC público exige el secreto.
  assert.throws(
    () => secretoNullifierCertificado({ HARDHAT_RPC_URL: RPC_PUBLICO, NODE_ENV: "development" }),
    /NULLIFIER_CERTIFICADO_SECRET/
  );
});

test("la validación de arranque exige un secreto largo fuera de local", () => {
  assert.doesNotThrow(() => validarSecretoNullifierCertificado(undefined, undefined));
  assert.doesNotThrow(() => validarSecretoNullifierCertificado(undefined, "http://localhost:8545"));
  assert.throws(() => validarSecretoNullifierCertificado(undefined, RPC_PUBLICO), /NULLIFIER_CERTIFICADO_SECRET/);
  assert.throws(() => validarSecretoNullifierCertificado("corto", RPC_PUBLICO), /32 caracteres/);
  assert.doesNotThrow(() => validarSecretoNullifierCertificado(SECRETO, RPC_PUBLICO));
});

test("con un RPC no local, el arranque (next.config.js) falla sin NULLIFIER_CERTIFICADO_SECRET", () => {
  const directorioWeb = fileURLToPath(new URL("..", import.meta.url));
  const entornoBase = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    HARDHAT_RPC_URL: RPC_PUBLICO,
    NEXT_PUBLIC_ZKPASSPORT_DOMAIN: "votos.ejemplo.es",
    NEXT_PUBLIC_ZKPASSPORT_DEV_MODE: "false",
  };
  const arrancar = (entorno) =>
    spawnSync(process.execPath, ["-e", 'require("./next.config.js")'], {
      cwd: directorioWeb,
      env: entorno,
      encoding: "utf8",
    });

  const sinSecreto = arrancar({ ...entornoBase, NODE_ENV: "development" });
  assert.notEqual(sinSecreto.status, 0);
  assert.match(sinSecreto.stderr, /NULLIFIER_CERTIFICADO_SECRET/);

  const conSecreto = arrancar({ ...entornoBase, NODE_ENV: "production", NULLIFIER_CERTIFICADO_SECRET: SECRETO });
  assert.equal(conSecreto.status, 0, conSecreto.stderr);
});

// ---------- R-04: el reto firmado incluye la opción ----------

test("un reto generado para una opción no vale para otra", async () => {
  const { reto, timestamp } = generarReto(PROPUESTA, "a_favor");
  const base = { propuestaId: PROPUESTA, timestamp, reto, signatureB64: "AAAA", certB64: "AAAA" };

  const otraOpcion = await verificarFirmaCertificado({ ...base, opcion: "en_contra" });
  assert.equal(otraOpcion.error, "El reto ha caducado o no es válido.");

  // Con la opción correcta el reto se acepta y la verificación sigue (y falla
  // después, porque la firma es basura).
  const mismaOpcion = await verificarFirmaCertificado({ ...base, opcion: "a_favor" });
  assert.equal(mismaOpcion.error, "No se ha podido leer la firma.");

  assert.notEqual(generarReto(PROPUESTA, "a_favor").reto, generarReto(PROPUESTA, "en_contra").reto);
});

// ---------- La firma y el certificado se descartan tras verificar ----------

const MARCADOR = "MARCADOR-NO-REGISTRAR-7Q2";

function firmarCmsDetached(retoHex) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const clave = forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs8", format: "pem" }));
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" }));
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const sujeto = [
    { name: "commonName", value: `PRUEBA ${MARCADOR}` },
    { type: "2.5.4.5", value: "IDCES-12345678Z" },
  ];
  cert.setSubject(sujeto);
  cert.setIssuer(sujeto);
  cert.sign(clave, forge.md.sha256.create());

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(Buffer.from(retoHex, "hex").toString("binary"));
  p7.addCertificate(cert);
  p7.addSigner({
    key: clave,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });

  const aBase64 = (asn1) => Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary").toString("base64");
  return { signatureB64: aBase64(p7.toAsn1()), certB64: aBase64(forge.pki.certificateToAsn1(cert)) };
}

test("no expone ni registra la firma, el certificado ni sus datos", async () => {
  const { reto, timestamp } = generarReto(PROPUESTA, "abstencion");
  const { signatureB64, certB64 } = firmarCmsDetached(reto);

  const registrado = [];
  const originales = {};
  for (const metodo of ["log", "info", "warn", "error", "debug"]) {
    originales[metodo] = console[metodo];
    console[metodo] = (...args) => registrado.push(args.map(String).join(" "));
  }
  let resultado;
  try {
    resultado = await verificarFirmaCertificado({
      propuestaId: PROPUESTA,
      opcion: "abstencion",
      timestamp,
      reto,
      signatureB64,
      certB64,
    });
  } finally {
    Object.assign(console, originales);
  }

  // La firma es válida; se rechaza después, al no encadenar hasta FNMT/DGP.
  assert.equal(resultado.valido, false);
  assert.equal(resultado.error, "El certificado no encadena hasta la FNMT ni la DGP (DNIe).");

  const visible = [JSON.stringify(resultado), ...registrado].join("\n");
  for (const secreto of [MARCADOR, "12345678Z", signatureB64.slice(0, 40), certB64.slice(0, 40)]) {
    assert.equal(visible.includes(secreto), false, `aparece ${secreto.slice(0, 20)}…`);
  }
});

test("el código del voto con certificado no guarda ni registra la firma ni el certificado", async () => {
  const fuentes = await Promise.all(
    ["../lib/certificado-digital.ts", "../app/api/propuesta/votos/certificado/route.ts"].map((ruta) =>
      readFile(new URL(ruta, import.meta.url), "utf8")
    )
  );
  for (const fuente of fuentes) {
    // Ningún registro menciona la firma, el certificado ni el CMS.
    for (const linea of fuente.split("\n").filter((l) => /console\.\w+\(/.test(l))) {
      assert.doesNotMatch(linea, /signature|certB64|cert\b|cms|firma|params|cuerpo/i, linea.trim());
    }
    // Nada se escribe en disco ni en la base de datos.
    assert.doesNotMatch(fuente, /writeFile|appendFile|createWriteStream|INSERT\s|guardarPropuesta|from ["'][^"']*\/db["']/);
  }
});
