const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Mismo address en Ethereum, Sepolia y Base (ver https://docs.zkpassport.id).
const ROOT_VERIFIER_ZKPASSPORT = "0x1D000001000EFD9a6371f4d90bB8920D5431c0D8";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const esLocal = hre.network.name === "localhost" || hre.network.name === "hardhat";

  // Deben coincidir con NEXT_PUBLIC_ZKPASSPORT_DOMAIN / NEXT_PUBLIC_ZKPASSPORT_DEV_MODE
  // de la web (ver README): de lo contrario votarConPruebaZk rechaza toda prueba. En
  // local se ignora ZKPASSPORT_DOMAIN/DEV_MODE del .env (que es para Sepolia/mainnet):
  // el MockRootVerifier no comprueba nada de esto, y así coincide con los valores por
  // defecto que usa la web en local (demo.zkpassport.id / devMode true).
  const DOMINIO_ZK = esLocal ? "demo.zkpassport.id" : process.env.ZKPASSPORT_DOMAIN ?? "demo.zkpassport.id";
  const DEV_MODE_ZK = esLocal ? true : process.env.ZKPASSPORT_DEV_MODE !== "false";

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

  const VotacionAnonima = await hre.ethers.getContractFactory("VotacionAnonima");
  const contrato = await VotacionAnonima.deploy(direccionVerificador, DOMINIO_ZK, DEV_MODE_ZK);
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
  console.log(`Verificador ZK: ${direccionVerificador} · dominio: ${DOMINIO_ZK} · devMode: ${DEV_MODE_ZK}`);
  console.log(
    "Las propuestas ya no se crean aqui: usa el formulario /propuestas/nueva de la web " +
      "(necesita DATABASE_URL configurada, ver README)."
  );
  if (hre.network.name !== "localhost") {
    console.log(
      `\nEn Vercel, define CONTRATO_DIRECCION=${deployment.address} ` +
        "(y HARDHAT_RPC_URL / HARDHAT_RELAYER_PRIVATE_KEY) para que la web use este despliegue."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
