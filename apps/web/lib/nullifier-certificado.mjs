import { createHmac } from "node:crypto";
import runtimeSecurity from "./runtime-security.js";

const { isLocalRpcUrl } = runtimeSecurity;

/**
 * Solo para un nodo local: nunca protege nada, existe para que el voto con
 * certificado funcione en desarrollo sin configurar el secreto.
 */
export const SECRETO_NULLIFIER_DESARROLLO = "civora-solo-desarrollo-local-no-usar-en-red-publica";

/**
 * Secreto con el que se deriva el nullifier de certificado. Fuera de un RPC
 * local es obligatorio (lo valida también next.config.js al arrancar). El
 * valor fijo de desarrollo depende solo de que el RPC sea local, no de
 * NODE_ENV.
 *
 * @param {Record<string, string | undefined>} env variables de entorno (NULLIFIER_CERTIFICADO_SECRET, HARDHAT_RPC_URL)
 * @returns {string}
 */
export function secretoNullifierCertificado(env) {
  const secreto = env.NULLIFIER_CERTIFICADO_SECRET;
  if (secreto) return secreto;
  if (isLocalRpcUrl(env.HARDHAT_RPC_URL)) return SECRETO_NULLIFIER_DESARROLLO;
  throw new Error("Falta NULLIFIER_CERTIFICADO_SECRET: es obligatoria fuera de un nodo local.");
}

/**
 * Nullifier de la vía de certificado: HMAC-SHA256 con un secreto del
 * servidor, para que nadie sin el secreto pueda recalcularlo enumerando
 * DNI (ver docs/decisiones/0005-no-publicar-nif.md). El operador, que tiene
 * el secreto, sí puede: esa deuda se cierra en la Fase 1.
 *
 * @param {string} propuestaId
 * @param {string} dni DNI canónico (ver normalizarDniCertificado)
 * @param {string} secreto
 * @returns {string} 64 caracteres hexadecimales
 */
export function derivarNullifierCertificado(propuestaId, dni, secreto) {
  return createHmac("sha256", secreto).update(`${propuestaId}:certificado:${dni}`).digest("hex");
}
