const {
  validarConfiguracionZkWeb,
  validarFalloAbiertoRevocacion,
  validarSecretoNullifierCertificado,
} = require("./runtime-security");

/**
 * Validaciones de arranque. Las ejecuta next.config.js (dev, build y
 * next start) y también arranque.js en la imagen Docker, porque el servidor
 * standalone de Next no ejecuta next.config.js. Si alguna falla, el
 * proceso termina y el contenedor no arranca.
 *
 * @param {Record<string, string | undefined>} [env]
 */
function validarEntorno(env = process.env) {
  validarFalloAbiertoRevocacion(env.FALLO_ABIERTO_REVOCACION === "true", env.HARDHAT_RPC_URL, env.NODE_ENV);
  validarConfiguracionZkWeb(
    env.NEXT_PUBLIC_ZKPASSPORT_DOMAIN,
    env.NEXT_PUBLIC_ZKPASSPORT_DEV_MODE,
    env.HARDHAT_RPC_URL,
    env.NODE_ENV,
    env.CIVORA_DEMO_TESTNET
  );
  validarSecretoNullifierCertificado(env.NULLIFIER_CERTIFICADO_SECRET, env.HARDHAT_RPC_URL);
}

module.exports = { validarEntorno };
