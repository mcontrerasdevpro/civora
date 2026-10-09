const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { obtenerConfiguracionDespliegue } = require("./deployment-config");

// Mismo address en Ethereum, Sepolia y Base (ver https://docs.zkpassport.id).
const ROOT_VERIFIER_ZKPASSPORT = "0x1D000001000EFD9a6371f4d90bB8920D5431c0D8";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { chainId } = await hre.ethers.provider.getNetwork();

  const { esLocal, dominioZk, devModeZk, relayerAddress, demoTestnet } = obtenerConfiguracionDespliegue(
    hre.network.name,
    process.env,
    deployer.address,
    chainId
  );
  if (demoTestnet) {
    console.log(`AVISO: demo pública en Sepolia (CIVORA_DEMO_TESTNET=true), devMode ${devModeZk}.`);
  }

  let direccionVerificador;
  if (esLocal) {
    // En redes locales no existe el RootVerifier real: se despliega un mock
    // que permite fijar de antemano el resultado de la verificacion (ver
    // contracts/zkpassport/MockRootVerifier.sol y test/VotacionAnonima.test.js).
    const MockRootVerifier = await hre.ethers.getContractFactory("MockRootVerifier");
    const mock = await MockRootVerifier.deploy();
    await mock.waitForDeployment();
    direccionVerificador = await mock.getAddress();
    console.log("MockRootVerifier (solo test local) desplegado en", direccionVerificador);
  } else {
    direccionVerificador = ROOT_VERIFIER_ZKPASSPORT;
  }

  // Tope de comisión opcional (gwei, p. ej. "0.01"). Sin él, Hardhat reserva
  // 1 gwei por unidad de gas: el despliegue usa unos 20 millones de gas en
  // Sepolia (unos 0,02 ETH reservados), aunque la comisión real sea mucho menor.
  const comisiones = {};
  const maxFeeGwei = process.env.DESPLIEGUE_MAX_FEE_GWEI;
  if (maxFeeGwei) {
    if (!/^\d+(\.\d+)?$/.test(maxFeeGwei)) throw new Error("DESPLIEGUE_MAX_FEE_GWEI debe ser un número en gwei, p. ej. 0.01");
    comisiones.maxFeePerGas = hre.ethers.parseUnits(maxFeeGwei, "gwei");
    const prioridad = hre.ethers.parseUnits("0.001", "gwei");
    comisiones.maxPriorityFeePerGas = prioridad < comisiones.maxFeePerGas ? prioridad : comisiones.maxFeePerGas;
  }

  const VotacionAnonima = await hre.ethers.getContractFactory("VotacionAnonima");
  const contrato = await VotacionAnonima.deploy(direccionVerificador, dominioZk, devModeZk, relayerAddress, comisiones);
  await contrato.waitForDeployment();

  const artifact = await hre.artifacts.readArtifact("VotacionAnonima");
  const deployment = {
    address: await contrato.getAddress(),
    abi: artifact.abi,
  };

  // Se escribe directamente en apps/web para que sea un import relativo
  // normal, en vez de depender de la resolucion de un paquete workspace.
  // Solo se usa en local: en redes publicas apps/web/lib/contrato.ts lee la
  // direccion de la variable de entorno CONTRATO_DIRECCION (ver deploy:sepolia).
  const outDir = path.join(__dirname, "..", "..", "..", "apps", "web", "lib", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `despliegue-${hre.network.name}.json`),
    JSON.stringify(deployment, null, 2)
  );

  console.log("VotacionAnonima desplegado en", deployment.address);
  console.log(`Verificador ZK: ${direccionVerificador} · dominio: ${dominioZk} · devMode: ${devModeZk}`);
  console.log(`Relayer inmutable: ${relayerAddress}`);
  console.log(
    "Las propuestas ya no se crean aqui: usa el formulario /propuestas/nueva de la web " +
      "(necesita DATABASE_URL configurada, ver README)."
  );
  if (hre.network.name !== "localhost") {
    console.log(
      `\nEn la plataforma donde se aloja la web (Easypanel u otra), define CONTRATO_DIRECCION=${deployment.address} ` +
        "junto con HARDHAT_RPC_URL y HARDHAT_RELAYER_PRIVATE_KEY, y comprueba el contrato con verificar:sepolia " +
        "(ver docs/despliegue-produccion.md)."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
