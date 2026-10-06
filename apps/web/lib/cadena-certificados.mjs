import { X509Certificate } from "node:crypto";

/**
 * Validación de la cadena del certificado del votante hasta una raíz de
 * confianza (FNMT-RCM o DGP/DNIe), con crypto.X509Certificate de Node
 * (OpenSSL). Sustituye a node-forge, que no tiene parche para
 * GHSA-86w9-cpqp-85rv (firmas RSA PKCS#1 v1.5 falsificables con claves de
 * exponente bajo).
 *
 * Cada eslabón exige: el emisor es una CA (`ca`), `checkIssued` (nombre del
 * emisor e identificadores de clave), firma válida (`verify`) y fechas de
 * validez. Los intermedios salen del propio CMS, es decir, los pone quien
 * firma: solo sirven para completar el camino; la confianza la dan
 * únicamente las raíces locales.
 *
 * Limitación: Node no expone `pathLenConstraint`; se limita la longitud
 * total de la cadena a LONGITUD_MAXIMA.
 */

export const LONGITUD_MAXIMA = 5;

/**
 * @param {Buffer | string} datos DER o PEM
 * @returns {X509Certificate | null}
 */
function leer(datos) {
  try {
    return new X509Certificate(datos);
  } catch {
    return null;
  }
}

/**
 * @param {X509Certificate} cert
 * @param {Date} ahora
 */
function vigente(cert, ahora) {
  return new Date(cert.validFrom) <= ahora && ahora <= new Date(cert.validTo);
}

/**
 * ¿`emisor` ha emitido y firmado `cert`?
 *
 * @param {X509Certificate} cert
 * @param {X509Certificate} emisor
 */
function emitidoPor(cert, emisor) {
  if (!emisor.ca) return false;
  try {
    return cert.checkIssued(emisor) && cert.verify(emisor.publicKey);
  } catch {
    return false;
  }
}

/**
 * @typedef {{ valida: true, hoja: X509Certificate, emisor: X509Certificate }
 *   | { valida: false, motivo: string }} ResultadoCadena
 */

/**
 * @param {Buffer} hojaDer certificado del firmante
 * @param {Buffer[]} intermediosDer certificados incluidos en el CMS (no confiables)
 * @param {(Buffer | string)[]} raices raíces de confianza (PEM o DER)
 * @param {Date} [ahora]
 * @returns {ResultadoCadena}
 */
export function verificarCadena(hojaDer, intermediosDer, raices, ahora = new Date()) {
  const hoja = leer(hojaDer);
  if (!hoja) return { valida: false, motivo: "hoja ilegible" };
  if (hoja.ca) return { valida: false, motivo: "la hoja es una CA" };

  const confianza = raices.map(leer).filter((c) => c !== null);
  const candidatos = intermediosDer.map(leer).filter((c) => c !== null);
  const huellasRaiz = new Set(confianza.map((c) => c.fingerprint256));

  /** @type {X509Certificate[]} */
  const cadena = [hoja];
  let actual = hoja;
  while (cadena.length <= LONGITUD_MAXIMA) {
    if (!vigente(actual, ahora)) return { valida: false, motivo: "certificado fuera de vigencia" };

    const raiz = confianza.find((r) => emitidoPor(actual, r));
    if (raiz) {
      if (!vigente(raiz, ahora)) return { valida: false, motivo: "raíz fuera de vigencia" };
      return { valida: true, hoja, emisor: cadena[1] ?? raiz };
    }

    const siguiente = candidatos.find(
      (c) =>
        !huellasRaiz.has(c.fingerprint256) &&
        !cadena.some((enCadena) => enCadena.fingerprint256 === c.fingerprint256) &&
        emitidoPor(actual, c)
    );
    if (!siguiente) return { valida: false, motivo: "no encadena hasta una raíz de confianza" };
    cadena.push(siguiente);
    actual = siguiente;
  }
  return { valida: false, motivo: "cadena demasiado larga" };
}
