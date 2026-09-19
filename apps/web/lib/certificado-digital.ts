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
 *   5. Que el certificado no este revocado, consultando por OCSP al
 *      respondedor que el propio certificado declara (extension Authority
 *      Information Access). No hay fallback a CRL todavia.
 *
 * FALLO_ABIERTO_REVOCACION (variable de entorno, por defecto false): que
 * hacer si no se puede completar la comprobacion OCSP (sin URL en el
 * certificado, respondedor caido, tiempo agotado...). Por defecto se
 * rechaza el voto (fallo cerrado): mas seguro, pero significa que un
 * respondedor OCSP caido bloquea esta via de voto por completo. Esto no se
 * ha podido probar contra los respondedores reales de la FNMT/DGP (solo
 * con certificados sinteticos); si en producción resulta poco fiable,
 * define FALLO_ABIERTO_REVOCACION=true para aceptar el voto cuando la
 * comprobacion no se pueda completar (no cuando el certificado SI conste
 * como revocado: eso siempre rechaza).
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

/** Las mismas raices de confianza, en formato pkijs (para verificar la firma de la respuesta OCSP). */
function raicesDeConfianzaPkijs(): pkijs.Certificate[] {
  const dir = path.join(process.cwd(), "lib", "certificados-raiz");
  return fs
    .readdirSync(dir)
    .filter((archivo) => archivo.endsWith(".pem"))
    .map((archivo) => {
      const pem = fs.readFileSync(path.join(dir, archivo), "utf8");
      const der = Buffer.from(forge.pki.pemToDer(pem).getBytes(), "binary");
      return new pkijs.Certificate({ schema: asn1js.fromBER(new Uint8Array(der).buffer).result });
    });
}

interface CertificadoPar {
  forge: forge.pki.Certificate;
  pkijs: pkijs.Certificate;
}

/**
 * Ordena la hoja seguida de sus emisores intermedios (buscando en la lista
 * de candidatos, no confiables por si solos, cual firma a cual) hasta llegar
 * a un certificado autofirmado o quedarse sin candidatos. El resultado se le
 * pasa a verifyCertificateChain junto con un almacen que solo tiene las
 * raices reales: eso es lo que impide que un intermedio (o la propia hoja)
 * se cuele como si fuera de confianza. Se conserva tambien la version pkijs
 * de cada certificado (necesaria para la comprobacion OCSP).
 */
function ordenarCadenaHastaRaiz(hoja: CertificadoPar, candidatos: CertificadoPar[]): CertificadoPar[] {
  const cadena = [hoja];
  const restantes = [...candidatos];
  let actual = hoja;
  while (!actual.forge.isIssuer(actual.forge)) {
    const indice = restantes.findIndex((candidato) => actual.forge.isIssuer(candidato.forge));
    if (indice === -1) break;
    actual = restantes[indice];
    cadena.push(actual);
    restantes.splice(indice, 1);
  }
  return cadena;
}

/** URL del respondedor OCSP declarado en la extension Authority Information Access, si existe. */
function urlOcsp(cert: pkijs.Certificate): string | null {
  const extension = cert.extensions?.find((e) => e.extnID === pkijs.id_AuthorityInfoAccess);
  const infoAccess = extension?.parsedValue as pkijs.InfoAccess | undefined;
  const descripcion = infoAccess?.accessDescriptions.find((d) => d.accessMethod === pkijs.id_ad_ocsp);
  const location = descripcion?.accessLocation;
  return location && location.type === 6 && typeof location.value === "string" ? location.value : null;
}

/** Verdadero si `hoja` esta firmado con la clave publica de `emisor` (sin comparar nombres). */
async function firmadoPorCriptograficamente(hoja: pkijs.Certificate, emisor: pkijs.Certificate): Promise<boolean> {
  try {
    return await hoja.verify(emisor);
  } catch {
    return false;
  }
}

/** Encuentra, dentro de los certificados de la respuesta OCSP, el que firmo la propia respuesta. */
async function localizarFirmanteOcsp(basicResponse: pkijs.BasicOCSPResponse): Promise<pkijs.Certificate | null> {
  const certs = basicResponse.certs;
  if (!certs || certs.length === 0) return null;

  const responderID = basicResponse.tbsResponseData.responderID;
  if (responderID instanceof pkijs.RelativeDistinguishedNames) {
    return certs.find((cert) => cert.subject.isEqual(responderID)) ?? null;
  }
  for (const cert of certs) {
    const hash = await webcrypto.subtle.digest("SHA-1", cert.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView);
    if (Buffer.compare(Buffer.from(hash), Buffer.from(responderID.valueBlock.valueHex)) === 0) {
      return cert;
    }
  }
  return null;
}

/**
 * Verifica la firma de una respuesta OCSP sin pasar por
 * BasicOCSPResponse.verify()/CertificateChainValidationEngine de pkijs: esas
 * clases exigen que el Issuer DN de cada certificado coincida BYTE A BYTE
 * con el Subject DN de su emisor ("Incorrect name chaining"), una exigencia
 * mas estricta que RFC 5280 que en la practica rompe con jerarquias reales
 * (la misma entidad puede quedar codificada con distinto tipo de string
 * ASN.1 -PrintableString/UTF8String- entre el certificado del firmante OCSP
 * y la raiz local). Aqui la cadena se construye solo con firmas
 * criptograficas (quien firmo a quien), que es lo unico que realmente
 * importa para la seguridad; los nombres no entran en la decision.
 */
async function verificarRespuestaOcsp(
  basicResponse: pkijs.BasicOCSPResponse,
  anclasDeConfianza: pkijs.Certificate[]
): Promise<{ ok: boolean; razon?: string }> {
  const certs = basicResponse.certs;
  if (!certs || certs.length === 0) return { ok: false, razon: "la respuesta OCSP no incluye certificados" };

  const signerCert = await localizarFirmanteOcsp(basicResponse);
  if (!signerCert) return { ok: false, razon: "no se encontro el certificado firmante dentro de la respuesta OCSP" };

  let actual = signerCert;
  const restantes = certs.filter((cert) => cert !== signerCert);
  let enlazado = false;
  for (let salto = 0; salto <= restantes.length && !enlazado; salto++) {
    for (const ancla of anclasDeConfianza) {
      if (await firmadoPorCriptograficamente(actual, ancla)) {
        enlazado = true;
        break;
      }
    }
    if (enlazado) break;

    let siguiente: pkijs.Certificate | null = null;
    for (const candidato of restantes) {
      if (candidato === actual) continue;
      if (await firmadoPorCriptograficamente(actual, candidato)) {
        siguiente = candidato;
        break;
      }
    }
    if (!siguiente) break;
    actual = siguiente;
  }
  if (!enlazado) {
    return {
      ok: false,
      razon: "no se ha podido enlazar criptograficamente el firmante de la respuesta OCSP con ninguna raiz de confianza",
    };
  }

  try {
    const motor = pkijs.getCrypto(true);
    const firmaOk = await motor.verifyWithPublicKey(
      new Uint8Array(basicResponse.tbsResponseData.tbsView),
      basicResponse.signature,
      signerCert.subjectPublicKeyInfo,
      basicResponse.signatureAlgorithm
    );
    if (!firmaOk) return { ok: false, razon: "la firma binaria de la respuesta OCSP no verifica con la clave del firmante" };
  } catch (error) {
    return { ok: false, razon: `excepcion al verificar la firma binaria: ${error instanceof Error ? error.message : String(error)}` };
  }

  return { ok: true };
}

/**
 * Consulta OCSP para el certificado de la hoja contra su emisor inmediato.
 * `comprobado` indica si se ha podido completar la consulta (URL presente,
 * respuesta recibida y firmada correctamente); `revocado` solo es
 * significativo cuando `comprobado` es true.
 */
async function comprobarRevocacion(
  hoja: pkijs.Certificate,
  emisor: pkijs.Certificate
): Promise<{ comprobado: boolean; revocado: boolean; razon?: string }> {
  const fallo = (razon: string) => {
    console.error("Comprobacion OCSP fallida:", razon);
    return { comprobado: false, revocado: false, razon };
  };

  const url = urlOcsp(hoja);
  if (!url) return fallo("El certificado no declara URL de OCSP (Authority Information Access).");

  try {
    const solicitud = new pkijs.OCSPRequest();
    await solicitud.createForCertificate(hoja, { hashAlgorithm: "SHA-1", issuerCertificate: emisor });
    const cuerpoSolicitud = Buffer.from(solicitud.toSchema(true).toBER(false));

    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/ocsp-request" },
      body: cuerpoSolicitud,
      signal: AbortSignal.timeout(5000),
    });
    if (!respuesta.ok) return fallo(`El respondedor OCSP (${url}) devolvio HTTP ${respuesta.status}.`);

    const cuerpoRespuesta = Buffer.from(await respuesta.arrayBuffer());
    const ocspResponse = new pkijs.OCSPResponse({
      schema: asn1js.fromBER(new Uint8Array(cuerpoRespuesta).buffer).result,
    });
    if (ocspResponse.responseStatus.valueBlock.valueDec !== 0 || !ocspResponse.responseBytes) {
      return fallo(`Respuesta OCSP con responseStatus=${ocspResponse.responseStatus.valueBlock.valueDec}.`);
    }

    const basicResponse = new pkijs.BasicOCSPResponse({
      schema: asn1js.fromBER(ocspResponse.responseBytes.response.valueBlock.valueHexView.slice().buffer).result,
    });

    // El certificado que firma la respuesta OCSP no siempre es el mismo
    // emisor directo de la hoja (a veces es una CA de OCSP delegada dentro
    // de la misma jerarquia), asi que se admite como ancla de confianza
    // tanto el emisor inmediato como las raices reales (FNMT/DGP).
    const anclasOcsp = [emisor, ...raicesDeConfianzaPkijs()];
    const resultadoFirma = await verificarRespuestaOcsp(basicResponse, anclasOcsp);
    if (!resultadoFirma.ok) {
      return fallo(`La firma de la respuesta OCSP no ha verificado: ${resultadoFirma.razon}`);
    }

    const estado = await basicResponse.getCertificateStatus(hoja, emisor);
    if (!estado.isForCertificate) return fallo("La respuesta OCSP no corresponde al certificado consultado.");
    // CertStatus segun RFC 6960: 0 good, 1 revoked, 2 unknown.
    if (estado.status !== 0 && estado.status !== 1) {
      return fallo(`Estado OCSP desconocido (status=${estado.status}).`);
    }
    return { comprobado: true, revocado: estado.status === 1 };
  } catch (error) {
    return fallo(`Excepcion durante la consulta OCSP: ${error instanceof Error ? error.message : String(error)}`);
  }
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

  // Autofirma en modo "explicit" produce CAdES detached: el reto firmado
  // no viaja dentro del CMS (no hay eContent), asi que hay que pasarselo a
  // verify() como `data` para que pueda recalcular el hash; sin esto pkijs
  // lanza "Missed detached data input array" y la firma se da por invalida
  // aunque sea correcta.
  const retoEsperado = Buffer.from(params.reto, "hex");
  const retoEsperadoArrayBuffer = retoEsperado.buffer.slice(
    retoEsperado.byteOffset,
    retoEsperado.byteOffset + retoEsperado.byteLength
  );

  let firmaValida: unknown;
  try {
    firmaValida = await signedData.verify({
      signer: 0,
      data: retoEsperadoArrayBuffer,
      trustedCerts: [certificadoLeaf, ...certificadosDeLaFirma],
      checkChain: false,
    });
  } catch {
    firmaValida = false;
  }
  if (firmaValida !== true) {
    return { valido: false, identificador: null, error: "La firma no ha superado la verificación criptográfica." };
  }

  // Si el CMS es "enveloping" (eContent presente) comprobamos ademas que
  // ese contenido coincide con el reto; en el caso detached, que verify()
  // haya aceptado la firma sobre `retoEsperado` ya lo garantiza.
  const eContent = signedData.encapContentInfo.eContent;
  if (eContent) {
    const contenidoFirmado = Buffer.from(eContent.valueBlock.valueHexView);
    if (contenidoFirmado.length !== retoEsperado.length || !timingSafeEqual(contenidoFirmado, retoEsperado)) {
      return { valido: false, identificador: null, error: "La firma no cubre el reto esperado." };
    }
  }

  // Cadena de confianza: el certificado debe encadenar hasta la FNMT o la
  // DGP (DNIe).
  let hojaPar: CertificadoPar;
  try {
    hojaPar = {
      pkijs: certificadoLeaf,
      forge: forge.pki.certificateFromAsn1(
        forge.asn1.fromDer(forge.util.createBuffer(certificadoLeafDer.toString("binary")))
      ),
    };
  } catch {
    return { valido: false, identificador: null, error: "No se ha podido leer el certificado (X.509)." };
  }

  const candidatos: CertificadoPar[] = [];
  for (const cert of certificadosDeLaFirma) {
    try {
      const der = Buffer.from(cert.toSchema().toBER(false));
      candidatos.push({
        pkijs: cert,
        forge: forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(der.toString("binary")))),
      });
    } catch {
      // certificado no parseable; se ignora, no participa en la cadena
    }
  }

  // IMPORTANTE: los "candidatos" salen del propio CMS, es decir, los pone
  // quien firma. Solo sirven para completar la cadena hasta una raiz real;
  // nunca deben entrar en el mismo almacen de confianza que las raices, o
  // un certificado autofirmado (o cualquier cadena inventada) se
  // "confiaria a si mismo" y la verificacion no serviria de nada.
  const caStore = forge.pki.createCaStore(raicesDeConfianza());
  const cadena = ordenarCadenaHastaRaiz(hojaPar, candidatos);
  let cadenaValida = false;
  try {
    cadenaValida = forge.pki.verifyCertificateChain(
      caStore,
      cadena.map((par) => par.forge)
    );
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

  const emisorInmediato = cadena[1]?.pkijs;
  const falloAbierto = process.env.FALLO_ABIERTO_REVOCACION === "true";
  if (emisorInmediato) {
    const { comprobado, revocado } = await comprobarRevocacion(certificadoLeaf, emisorInmediato);
    if (revocado) {
      return { valido: false, identificador: null, error: "El certificado ha sido revocado." };
    }
    if (!comprobado && !falloAbierto) {
      // La razon detallada del fallo ya queda registrada en el servidor via
      // console.error dentro de comprobarRevocacion; no se expone al cliente.
      return {
        valido: false,
        identificador: null,
        error: "No se ha podido comprobar si el certificado está revocado (OCSP no disponible).",
      };
    }
  } else if (!falloAbierto) {
    return {
      valido: false,
      identificador: null,
      error: "No se ha podido determinar el emisor del certificado para comprobar su revocación.",
    };
  }

  return { valido: true, identificador: identificadorDeCertificado(hojaPar.forge) };
}

/** Nullifier final, propuesta-especifico, a partir del identificador del certificado ya verificado. */
export async function derivarNullifierCertificado(propuestaId: string, identificador: string): Promise<string> {
  const datos = new TextEncoder().encode(`${propuestaId}:certificado:${identificador}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
