function isLocalRpcUrl(rpcUrl) {
  if (!rpcUrl) return true;
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(rpcUrl).hostname);
  } catch {
    return false;
  }
}

function validarFalloAbiertoRevocacion(falloAbierto, rpcUrl, nodeEnv) {
  if (falloAbierto && nodeEnv === "production" && !isLocalRpcUrl(rpcUrl)) {
    throw new Error("FALLO_ABIERTO_REVOCACION=true no está permitido en entornos no locales.");
  }
}

/**
 * En producción con red no local exige dominio propio y DEV_MODE=false,
 * salvo la demo pública con opt-in CIVORA_DEMO_TESTNET=true, que exige
 * DEV_MODE explícito. Es el contrato quien impide la demo en una red
 * principal: solo el despliegue en Sepolia puede activar devModeZk.
 */
function validarConfiguracionZkWeb(dominio, devMode, rpcUrl, nodeEnv, demoTestnet) {
  if (nodeEnv !== "production" || isLocalRpcUrl(rpcUrl)) return;
  if (demoTestnet === "true") {
    if (devMode !== "true" && devMode !== "false") {
      throw new Error("Con CIVORA_DEMO_TESTNET=true define NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=true o false de forma explícita.");
    }
    return;
  }
  if (!dominio || dominio === "demo.zkpassport.id") {
    throw new Error("En redes no locales define NEXT_PUBLIC_ZKPASSPORT_DOMAIN con tu dominio propio.");
  }
  if (devMode !== "false") {
    throw new Error("En redes no locales define explícitamente NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false.");
  }
}

/** Longitud mínima del secreto del nullifier de certificado (R-02). */
const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Fuera de un RPC local, NULLIFIER_CERTIFICADO_SECRET es obligatoria y debe
 * ser larga. Depende solo del RPC, no de NODE_ENV: `next dev` contra
 * Sepolia también la exige.
 */
function validarSecretoNullifierCertificado(secreto, rpcUrl) {
  if (isLocalRpcUrl(rpcUrl)) return;
  if (!secreto || secreto.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `Fuera de un nodo local define NULLIFIER_CERTIFICADO_SECRET con al menos ${LONGITUD_MINIMA_SECRETO} caracteres.`
    );
  }
}

module.exports = {
  isLocalRpcUrl,
  validarFalloAbiertoRevocacion,
  validarConfiguracionZkWeb,
  validarSecretoNullifierCertificado,
};