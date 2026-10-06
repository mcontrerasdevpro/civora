const TABLA_LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

/**
 * Prefijos del atributo serialNumber del sujeto que preceden al DNI:
 * - Identificador semántico de ETSI EN 319 412-1 (§5.1.3): tipo de 3 letras
 *   + país + guion. La FNMT usa "IDCES-" en los certificados de persona
 *   física; "PNOES-", "TINES-" y "TAXES-" son las otras formas del estándar
 *   para un número nacional o fiscal español.
 * - "NIF", con o sin ":" o espacio, presente en certificados antiguos.
 */
const PREFIJOS = /^(?:(?:IDC|PNO|TIN|TAX)ES[-:]?|NIF[:\s-]*)/;

/**
 * Devuelve el DNI canónico (8 cifras + letra de control válida) o null.
 * Rechaza NIE, CIF y cualquier otro formato: el requisito es DNI español.
 *
 * @param {string | null | undefined} valor
 * @returns {string | null}
 */
export function normalizarDniCertificado(valor) {
  if (typeof valor !== "string") return null;
  const sinPrefijo = valor.trim().toUpperCase().replace(PREFIJOS, "");
  const compacto = sinPrefijo.replace(/[\s.\-_/]/g, "");
  const partes = /^(\d{8})([A-Z])$/.exec(compacto);
  if (!partes) return null;
  const [, numero, letra] = partes;
  return TABLA_LETRAS[Number(numero) % 23] === letra ? `${numero}${letra}` : null;
}

/**
 * DNI del titular a partir del serialNumber del sujeto (OID 2.5.4.5),
 * normalizado. null si falta o no es un DNI válido.
 */
export function nifDeCertificado(cert) {
  const field = cert.subject.getField({ shortName: "serialNumber" }) ?? cert.subject.getField({ type: "2.5.4.5" });
  return field?.value ? normalizarDniCertificado(String(field.value)) : null;
}
