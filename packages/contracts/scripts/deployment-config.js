const DOMINIO_DEMO = "demo.zkpassport.id";

function obtenerConfiguracionDespliegue(networkName, env, deployerAddress) {
  const esLocal = networkName === "localhost" || networkName === "hardhat";
  if (esLocal) {
    return {
      esLocal,
      dominioZk: env.ZKPASSPORT_DOMAIN?.trim() || DOMINIO_DEMO,
      devModeZk: env.ZKPASSPORT_DEV_MODE === "true",
      relayerAddress: deployerAddress,
    };
  }

  const dominioZk = env.ZKPASSPORT_DOMAIN?.trim();
  if (!dominioZk || dominioZk === DOMINIO_DEMO) {
    throw new Error("En redes no locales define ZKPASSPORT_DOMAIN con tu dominio propio de ZKPassport.");
  }
  if (env.ZKPASSPORT_DEV_MODE !== "false") {
    throw new Error("En redes no locales define explícitamente ZKPASSPORT_DEV_MODE=false.");
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(env.RELAYER_ADDRESS ?? "")) {
    throw new Error("En redes no locales define RELAYER_ADDRESS con la dirección pública del relayer.");
  }

  return {
    esLocal,
    dominioZk,
    devModeZk: false,
    relayerAddress: env.RELAYER_ADDRESS,
  };
}

module.exports = { obtenerConfiguracionDespliegue };