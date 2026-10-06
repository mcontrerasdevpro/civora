const hre = require("hardhat");

/**
 * Comprueba un contrato ya desplegado contra la configuración esperada, sin
 * manejar claves privadas: compara direcciones públicas.
 *
 *   CONTRATO_DIRECCION   dirección impresa por deploy:sepolia
 *   RELAYER_ADDRESS      dirección pública de HARDHAT_RELAYER_PRIVATE_KEY
 *   ZKPASSPORT_DOMAIN    dominio esperado (opcional)
 *   ZKPASSPORT_DEV_MODE  "true" o "false" esperado (opcional)
 *
 * Termina con código 1 si algo no coincide.
 */
async function main() {
  const { CONTRATO_DIRECCION, RELAYER_ADDRESS, ZKPASSPORT_DOMAIN, ZKPASSPORT_DEV_MODE } = process.env;
  if (!hre.ethers.isAddress(CONTRATO_DIRECCION ?? "") || !hre.ethers.isAddress(RELAYER_ADDRESS ?? "")) {
    throw new Error("Define CONTRATO_DIRECCION y RELAYER_ADDRESS con direcciones válidas.");
  }

  const contrato = await hre.ethers.getContractAt("VotacionAnonima", CONTRATO_DIRECCION);
  const { chainId } = await hre.ethers.provider.getNetwork();
  const relayer = await contrato.relayer();
  const dominio = await contrato.dominioZk();
  const devMode = await contrato.devModeZk();

  console.log(`Red: ${hre.network.name} (chainId ${chainId})`);
  console.log(`Relayer fijado: ${relayer}`);
  console.log(`Dominio ZK: ${dominio} · devMode: ${devMode}`);

  const fallos = [];
  if (relayer.toLowerCase() !== RELAYER_ADDRESS.toLowerCase()) {
    fallos.push(`el relayer fijado (${relayer}) no es RELAYER_ADDRESS (${RELAYER_ADDRESS})`);
  }
  if (ZKPASSPORT_DOMAIN && dominio !== ZKPASSPORT_DOMAIN.trim()) {
    fallos.push(`el dominio (${dominio}) no es ZKPASSPORT_DOMAIN (${ZKPASSPORT_DOMAIN})`);
  }
  if (ZKPASSPORT_DEV_MODE && String(devMode) !== ZKPASSPORT_DEV_MODE) {
    fallos.push(`devModeZk (${devMode}) no es ZKPASSPORT_DEV_MODE (${ZKPASSPORT_DEV_MODE})`);
  }

  if (fallos.length > 0) {
    fallos.forEach((fallo) => console.error(`ERROR: ${fallo}`));
    process.exitCode = 1;
    return;
  }
  console.log("OK: el contrato coincide con la configuración esperada.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
