import { createHmac, timingSafeEqual, webcrypto } from "crypto";
import fs from "fs";
import path from "path";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import forge from "node-forge";

/**
 * Verificacion de identidad por certificado digital (FNMT / DNIe), via
 * Autofirma: https://github.com/ctt-gob-es/clienteafirma. El navegador le
 * pide a Autofirma que firme un reto aleatorio con el certificado instalado
 * del usuario (ver public/js/autoscript.js), y este modulo comprueba en el
 * servidor:
 *   1. Que el reto no ha caducado y no ha sido manipulado (HMAC propio, sin
 *      guardar estado: nada que limpiar ni base de datos de retos).
 *   2. Que la firma CMS/CAdES es criptograficamente valida.
 *   3. Que lo firmado es exactamente el reto esperado (no basta con que la
 *      firma sea valida sobre "algo": tiene que cubrir este reto).
 *   4. Que el certificado del firmante encadena hasta una autoridad de
 *      confianza real (FNMT-RCM o la Direccion General de la Policia/DNIe).
 *
 * LIMITACION IMPORTANTE (ver docs/modelo-amenazas.md): un certificado
 * personal no lleva la fecha de nacimiento, asi que esta via NO puede
 * demostrar criptograficamente la mayoria de edad como si hace ZKPassport
 * leyendo el chip del DNIe/pasaporte. Solo prueba la identidad (con fuerza
 * real: quien firma posee ese certificado). La edad se acepta autodeclarada,
 * igual que en la via manual.
 *
 * Tampoco se comprueba revocacion (OCSP/CRL) del certificado: pendiente.
 */

let motorConfigurado = false;
function asegurarMotorCriptografico(): void {
  if (motorConfigurado) return;
  pkijs.setEngine("node", new pkijs.CryptoEngine({ name: "node", crypto: webcrypto as unknown as Crypto }));
  motorConfigurado = true;
}

const RETO_TTL_MS = 5 * 60 * 1000;

function claveReto(): string {
  const clave = process.env.RETO_CERTIFICADO_SECRET;
  if (!clave) {
    throw new Error("Falta RETO_CERTIFICADO_SECRET: defínela en apps/web/.env.local (ver README).");
  }
  return clave;
}

function hmacReto(propuestaId: string, timestamp: number): string {
  return createHmac("sha256", claveReto()).update(`${propuestaId}:${timestamp}`).digest("hex");
}

export function generarReto(propuestaId: string): { reto: string; timestamp: number } {
  const timestamp = Date.now();
  return { reto: hmacReto(propuestaId, timestamp), timestamp };
}

function retoValido(propuestaId: string, timestamp: number, reto: string): boolean {
  const ahora = Date.now();
  if (timestamp > ahora || ahora - timestamp > RETO_TTL_MS) return false;
  const esperado = hmacReto(propuestaId, timestamp);
  const a = Buffer.from(reto, "hex");
  const b = Buffer.from(esperado, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function raicesDeConfianza(): forge.pki.Certificate[] {
  const dir = path.join(process.cwd(), "lib", "certificados-raiz");
  return fs
    .readdirSync(dir)
    .filter((archivo) => archivo.endsWith(".pem"))
    .map((archivo) => forge.pki.certificateFromPem(fs.readFileSync(path.join(dir, archivo), "utf8")));
}

/**
 * Ordena la hoja seguida de sus emisores intermedios (buscando en la lista
 * de candidatos, no confiables por si solos, cual firma a cual) hasta llegar
 * a un certificado autofirmado o quedarse sin candidatos. El resultado se le
 * pasa a verifyCertificateChain junto con un almacen que solo tiene las
 * raices reales: eso es lo que impide que un intermedio (o la propia hoja)
 * se cuele como si fuera de confianza.
 */
function ordenarCadenaHastaRaiz(
  hoja: forge.pki.Certificate,
  candidatos: forge.pki.Certificate[]
): forge.pki.Certificate[] {
  const cadena = [hoja];
  const restantes = [...candidatos];
  let actual = hoja;
  while (!actual.isIssuer(actual)) {
    const indice = restantes.findIndex((candidato) => actual.isIssuer(candidato));
    if (indice === -1) break;
    actual = restantes[indice];
    cadena.push(actual);
    restantes.splice(indice, 1);
  }
  return cadena;
}

/** DNI/NIF del titular si el certificado lo declara en el subject; si no, un identificador estable del propio certificado. */
function identificadorDeCertificado(cert: forge.pki.Certificate): string {
  const campoSerie =
    cert.subject.getField({ shortName: "serialNumber" }) ?? cert.subject.getField({ type: "2.5.4.5" });
  if (campoSerie?.value) return String(campoSerie.value);
  const emisor = cert.issuer.attributes.map((a) => `${a.shortName ?? a.type}=${a.value}`).join(",");
  return `${emisor}#${cert.serialNumber}`;
}

export interface ResultadoVerificacionCertificado {
  valido: boolean;
  identificador: string | null;
  error?: string;
}

export async function verificarFirmaCertificado(params: {
  propuestaId: string;
  timestamp: number;
  reto: string;
  signatureB64: string;
  certB64: string;
}): Promise<ResultadoVerificacionCertificado> {
  asegurarMotorCriptografico();

  if (!retoValido(params.propuestaId, params.timestamp, params.reto)) {
    return { valido: false, identificador: null, error: "El reto ha caducado o no es válido." };
  }

  let signedData: pkijs.SignedData;
  try {
    const cmsDer = Buffer.from(params.signatureB64, "base64");
    const asn1 = asn1js.fromBER(new Uint8Array(cmsDer).buffer);
    if (asn1.offset === -1) throw new Error("ASN.1 inválido");
    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
    signedData = new pkijs.SignedData({ schema: contentInfo.content });
  } catch {
    return { valido: false, identificador: null, error: "No se ha podido leer la firma." };
  }

  if (signedData.signerInfos.length === 0) {
    return { valido: false, identificador: null, error: "La firma no contiene firmantes." };
  }

  let certificadoLeaf: pkijs.Certificate;
  let certificadoLeafDer: Buffer;
  try {
    certificadoLeafDer = Buffer.from(params.certB64, "base64");
    certificadoLeaf = new pkijs.Certificate({
      schema: asn1js.fromBER(new Uint8Array(certificadoLeafDer).buffer).result,
    });
  } catch {
    return { valido: false, identificador: null, error: "El certificado recibido no es válido." };
  }

  const certificadosDeLaFirma = (signedData.certificates ?? []).filter(
    (cert): cert is pkijs.Certificate => cert instanceof pkijs.Certificate
  );

  let firmaValida: unknown;
  try {
    firmaValida = await signedData.verify({
      signer: 0,
      trustedCerts: [certificadoLeaf, ...certificadosDeLaFirma],
      checkChain: false,
    });
  } catch {
    firmaValida = false;
  }
  if (firmaValida !== true) {
    return { valido: false, identificador: null, error: "La firma no ha superado la verificación criptográfica." };
  }

  // No basta con que la firma sea valida "sobre algo": tiene que cubrir
  // exactamente el reto que emitimos, byte a byte.
  const eContent = signedData.encapContentInfo.eContent;
  const contenidoFirmado = eContent ? Buffer.from(eContent.valueBlock.valueHexView) : null;
  const retoEsperado = Buffer.from(params.reto, "hex");
  if (
    !contenidoFirmado ||
    contenidoFirmado.length !== retoEsperado.length ||
    !timingSafeEqual(contenidoFirmado, retoEsperado)
  ) {
    return { valido: false, identificador: null, error: "La firma no cubre el reto esperado." };
  }

  // Cadena de confianza: el certificado debe encadenar hasta la FNMT o la
  // DGP (DNIe). No se comprueba revocacion (OCSP/CRL), ver modelo-amenazas.md.
  let certificadoForge: forge.pki.Certificate;
  try {
    certificadoForge = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(forge.util.createBuffer(certificadoLeafDer.toString("binary")))
    );
  } catch {
    return { valido: false, identificador: null, error: "No se ha podido leer el certificado (X.509)." };
  }

  const intermedios: forge.pki.Certificate[] = [];
  for (const cert of certificadosDeLaFirma) {
    try {
      const der = Buffer.from(cert.toSchema().toBER(false));
      intermedios.push(forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(der.toString("binary")))));
    } catch {
      // certificado no parseable; se ignora, no participa en la cadena
    }
  }

  // IMPORTANTE: los "intermedios" salen del propio CMS, es decir, los pone
  // quien firma. Solo sirven para completar la cadena hasta una raiz real;
  // nunca deben entrar en el mismo almacen de confianza que las raices, o
  // un certificado autofirmado (o cualquier cadena inventada) se
  // "confiaria a si mismo" y la verificacion no serviria de nada.
  const caStore = forge.pki.createCaStore(raicesDeConfianza());
  const cadena = ordenarCadenaHastaRaiz(certificadoForge, intermedios);
  let cadenaValida = false;
  try {
    cadenaValida = forge.pki.verifyCertificateChain(caStore, cadena);
  } catch {
    cadenaValida = false;
  }
  if (!cadenaValida) {
    return {
      valido: false,
      identificador: null,
      error: "El certificado no encadena hasta la FNMT ni la DGP (DNIe).",
    };
  }

  return { valido: true, identificador: identificadorDeCertificado(certificadoForge) };
}

/** Nullifier final, propuesta-especifico, a partir del identificador del certificado ya verificado. */
export async function derivarNullifierCertificado(propuestaId: string, identificador: string): Promise<string> {
  const datos = new TextEncoder().encode(`${propuestaId}:certificado:${identificador}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
