const DOMINIO_DEMO = "demo.zkpassport.id";
const CHAIN_ID_SEPOLIA = 11155111;
const DIRECCION = /^0x[a-fA-F0-9]{40}$/;

/**
 * En redes públicas exige dominio propio y DEV_MODE=false (hallazgo C-02).
 * Única excepción: la demo pública en Sepolia, con opt-in explícito
 * CIVORA_DEMO_TESTNET=true (ver docs/decisiones/0010-demo-publica-testnet.md).
 * devModeZk queda inmutable en el contrato, así que una red principal nunca
 * puede aceptar pruebas de demostración.
 */
function obtenerConfiguracionDespliegue(networkName, env, deployerAddress, chainId) {
  const esLocal = networkName === "localhost" || networkName === "hardhat";
  if (esLocal) {
    return {
      esLocal,
      dominioZk: env.ZKPASSPORT_DOMAIN?.trim() || DOMINIO_DEMO,
      devModeZk: env.ZKPASSPORT_DEV_MODE === "true",
      relayerAddress: deployerAddress,
    };
  }

  if (env.CIVORA_DEMO_TESTNET === "true") {
    if (Number(chainId) !== CHAIN_ID_SEPOLIA) {
      throw new Error(`CIVORA_DEMO_TESTNET solo se permite en Sepolia (chainId ${CHAIN_ID_SEPOLIA}).`);
    }
    if (env.ZKPASSPORT_DEV_MODE !== "true" && env.ZKPASSPORT_DEV_MODE !== "false") {
      throw new Error("Con CIVORA_DEMO_TESTNET=true define ZKPASSPORT_DEV_MODE=true o false de forma explícita.");
    }
    if (!DIRECCION.test(env.RELAYER_ADDRESS ?? "")) {
      throw new Error("En redes no locales define RELAYER_ADDRESS con la dirección pública del relayer.");
    }
    return {
      esLocal,
      dominioZk: env.ZKPASSPORT_DOMAIN?.trim() || DOMINIO_DEMO,
      devModeZk: env.ZKPASSPORT_DEV_MODE === "true",
      relayerAddress: env.RELAYER_ADDRESS,
      demoTestnet: true,
    };
  }

  const dominioZk = env.ZKPASSPORT_DOMAIN?.trim();
  if (!dominioZk || dominioZk === DOMINIO_DEMO) {
    throw new Error("En redes no locales define ZKPASSPORT_DOMAIN con tu dominio propio de ZKPassport.");
  }
  if (env.ZKPASSPORT_DEV_MODE !== "false") {
    throw new Error("En redes no locales define explícitamente ZKPASSPORT_DEV_MODE=false.");
  }
  if (!DIRECCION.test(env.RELAYER_ADDRESS ?? "")) {
    throw new Error("En redes no locales define RELAYER_ADDRESS con la dirección pública del relayer.");
  }

  return {
    esLocal,
    dominioZk,
    devModeZk: false,
    relayerAddress: env.RELAYER_ADDRESS,
    demoTestnet: false,
  };
}

module.exports = { obtenerConfiguracionDespliegue, CHAIN_ID_SEPOLIA };