import assert from "node:assert/strict";
import { X509Certificate, generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { LONGITUD_MAXIMA, verificarCadena } from "../lib/cadena-certificados.mjs";
import { nifDeCertificado, nifDeSujeto } from "../lib/nif-certificado.mjs";

// node-forge solo se usa aquí, para fabricar certificados de prueba; la
// aplicación ya no lo usa (GHSA-86w9-cpqp-85rv, sin parche).
const require = createRequire(import.meta.url);
const forge = require("node-forge");

const DIA = 86_400_000;
let serie = 1;

function claves() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    publica: forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" })),
    privada: forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs8", format: "pem" })),
  };
}

/**
 * @param {{ nombre: string, ca: boolean, emisor?: { cert: any, privada: any }, desde?: number, hasta?: number, sujetoExtra?: object[] }} o
 */
function certificado({ nombre, ca, emisor, desde = -DIA, hasta = 365 * DIA, sujetoExtra = [] }) {
  const k = claves();
  const cert = forge.pki.createCertificate();
  cert.publicKey = k.publica;
  cert.serialNumber = String(serie++).padStart(2, "0");
  cert.validity.notBefore = new Date(Date.now() + desde);
  cert.validity.notAfter = new Date(Date.now() + hasta);
  const sujeto = [{ name: "countryName", value: "ES" }, { name: "commonName", value: nombre }, ...sujetoExtra];
  cert.setSubject(sujeto);
  cert.setIssuer(emisor ? emisor.cert.subject.attributes : sujeto);
  cert.setExtensions([
    { name: "basicConstraints", cA: ca, critical: true },
    { name: "keyUsage", keyCertSign: ca, cRLSign: ca, digitalSignature: !ca, critical: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(emisor ? emisor.privada : k.privada, forge.md.sha256.create());
  const der = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary");
  return { cert, privada: k.privada, der, pem: forge.pki.certificateToPem(cert) };
}

const raiz = certificado({ nombre: "RAIZ PRUEBA", ca: true });
const intermedio = certificado({ nombre: "INTERMEDIO PRUEBA", ca: true, emisor: raiz });
const hoja = certificado({
  nombre: "TITULAR PRUEBA",
  ca: false,
  emisor: intermedio,
  sujetoExtra: [{ type: "2.5.4.5", value: "IDCES-12345678Z" }],
});

test("acepta hoja → intermedio → raíz de confianza y devuelve el emisor inmediato", () => {
  const resultado = verificarCadena(hoja.der, [intermedio.der], [raiz.pem]);
  assert.equal(resultado.valida, true);
  assert.equal(resultado.emisor.subject, new X509Certificate(intermedio.der).subject);
  assert.equal(nifDeCertificado(resultado.hoja), "12345678Z");
});

test("acepta una hoja emitida directamente por la raíz; el emisor es la raíz", () => {
  const directa = certificado({ nombre: "DIRECTA", ca: false, emisor: raiz });
  const resultado = verificarCadena(directa.der, [], [raiz.pem]);
  assert.equal(resultado.valida, true);
  assert.equal(resultado.emisor.fingerprint256, new X509Certificate(raiz.der).fingerprint256);
});

test("rechaza un certificado autofirmado", () => {
  const autofirmado = certificado({ nombre: "AUTOFIRMADO", ca: false });
  assert.equal(verificarCadena(autofirmado.der, [autofirmado.der], [raiz.pem]).valida, false);
});

test("rechaza una cadena con un intermedio falso que imita el nombre del real", () => {
  // Mismo nombre que el intermedio real, pero firmado por sí mismo.
  const falso = certificado({ nombre: "INTERMEDIO PRUEBA", ca: true });
  const hojaFalsa = certificado({ nombre: "TITULAR FALSO", ca: false, emisor: falso });
  assert.equal(verificarCadena(hojaFalsa.der, [falso.der, intermedio.der], [raiz.pem]).valida, false);
});

test("rechaza si falta el intermedio o si la raíz no es de confianza", () => {
  assert.equal(verificarCadena(hoja.der, [], [raiz.pem]).valida, false);
  const otraRaiz = certificado({ nombre: "OTRA RAIZ", ca: true });
  assert.equal(verificarCadena(hoja.der, [intermedio.der], [otraRaiz.pem]).valida, false);
  // Meter la raíz entre los intermedios del CMS no la hace de confianza.
  assert.equal(verificarCadena(hoja.der, [intermedio.der, raiz.der], [otraRaiz.pem]).valida, false);
});

test("rechaza certificados caducados o aún no válidos", () => {
  const caducado = certificado({ nombre: "CADUCADO", ca: false, emisor: intermedio, desde: -10 * DIA, hasta: -DIA });
  const futuro = certificado({ nombre: "FUTURO", ca: false, emisor: intermedio, desde: DIA, hasta: 10 * DIA });
  assert.equal(verificarCadena(caducado.der, [intermedio.der], [raiz.pem]).valida, false);
  assert.equal(verificarCadena(futuro.der, [intermedio.der], [raiz.pem]).valida, false);
});

test("rechaza un emisor que no es CA y una hoja que es CA", () => {
  const noCa = certificado({ nombre: "NO CA", ca: false, emisor: raiz });
  const hijaDeNoCa = certificado({ nombre: "HIJA", ca: false, emisor: noCa });
  assert.equal(verificarCadena(hijaDeNoCa.der, [noCa.der], [raiz.pem]).valida, false);
  assert.equal(verificarCadena(intermedio.der, [], [raiz.pem]).valida, false);
});

test("rechaza cadenas más largas que el máximo y entradas ilegibles", () => {
  let emisor = raiz;
  const intermedios = [];
  for (let i = 0; i < LONGITUD_MAXIMA + 1; i += 1) {
    emisor = certificado({ nombre: `NIVEL ${i}`, ca: true, emisor });
    intermedios.push(emisor.der);
  }
  const profunda = certificado({ nombre: "PROFUNDA", ca: false, emisor });
  assert.equal(verificarCadena(profunda.der, intermedios, [raiz.pem]).valida, false);
  assert.equal(verificarCadena(Buffer.from("basura"), [], [raiz.pem]).valida, false);
});

test("las raíces reales FNMT y DGP se leen y son CA con RSA e=65537", async () => {
  for (const archivo of ["fnmt-rcm-raiz.pem", "dnie-raiz-2.pem"]) {
    const pem = await readFile(new URL(`../lib/certificados-raiz/${archivo}`, import.meta.url), "utf8");
    const cert = new X509Certificate(pem);
    assert.equal(cert.ca, true, archivo);
    assert.equal(cert.publicKey.asymmetricKeyDetails.publicExponent, 65537n, archivo);
  }
});

test("nifDeSujeto lee un único serialNumber del sujeto", () => {
  assert.equal(nifDeSujeto("C=ES\nserialNumber=IDCES-12345678Z\nCN=TITULAR"), "12345678Z");
  assert.equal(nifDeSujeto("C=ES\nCN=TITULAR"), null);
  assert.equal(nifDeSujeto("serialNumber=12345678Z\nserialNumber=87654321X"), null);
  assert.equal(nifDeSujeto("CN=serialNumber=12345678Z"), null);
});

test("la aplicación ya no importa node-forge", async () => {
  const paquete = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(paquete.dependencies["node-forge"], undefined);
  for (const ruta of ["../lib/certificado-digital.ts", "../lib/cadena-certificados.mjs", "../lib/nif-certificado.mjs"]) {
    const fuente = await readFile(new URL(ruta, import.meta.url), "utf8");
    assert.doesNotMatch(fuente, /from ["']node-forge["']|require\(["']node-forge["']\)/, ruta);
  }
});
