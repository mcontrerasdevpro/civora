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

function validarConfiguracionZkWeb(dominio, devMode, rpcUrl, nodeEnv) {
  if (nodeEnv !== "production" || isLocalRpcUrl(rpcUrl)) return;
  if (!dominio || dominio === "demo.zkpassport.id") {
    throw new Error("En redes no locales define NEXT_PUBLIC_ZKPASSPORT_DOMAIN con tu dominio propio.");
  }
  if (devMode !== "false") {
    throw new Error("En redes no locales define explícitamente NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false.");
  }
}

module.exports = { isLocalRpcUrl, validarFalloAbiertoRevocacion, validarConfiguracionZkWeb };