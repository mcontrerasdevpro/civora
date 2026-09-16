const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Debe coincidir con apps/web/lib/propuesta-demo.ts (unica propuesta de esta PoC).
const PROPUESTA_ID = "b3f1a2c4-4d5e-4a6b-8c7d-9e0f1a2b3c4d";
const TITULO = "Presupuestos participativos 2027";
const DURACION_DIAS = 30;

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const VotacionAnonima = await hre.ethers.getContractFactory("VotacionAnonima");
  // Verificador ZK real pendiente (ver docs/modelo-amenazas.md): se usa la
  // direccion del propio deployer como placeholder, sin efecto todavia
  // porque el contrato aun no llama al verificador.
  const contrato = await VotacionAnonima.deploy(deployer.address);
  await contrato.waitForDeployment();

  const propuestaIdBytes32 = hre.ethers.id(PROPUESTA_ID);
  const contenidoHash = hre.ethers.id(JSON.stringify({ id: PROPUESTA_ID, titulo: TITULO }));
  const duracionSegundos = DURACION_DIAS * 24 * 60 * 60;

  const tx = await contrato.crearPropuesta(propuestaIdBytes32, contenidoHash, duracionSegundos);
  await tx.wait();

  const artifact = await hre.artifacts.readArtifact("VotacionAnonima");
  const deployment = {
    address: await contrato.getAddress(),
    propuestaId: PROPUESTA_ID,
    propuestaIdBytes32,
    abi: artifact.abi,
  };

  // Se escribe directamente en apps/web para que sea un import relativo
  // normal, en vez de depender de la resolucion de un paquete workspace.
  const outDir = path.join(__dirname, "..", "..", "..", "apps", "web", "lib", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "despliegue-localhost.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("VotacionAnonima desplegado en", deployment.address);
  console.log("Propuesta demo creada con id bytes32", propuestaIdBytes32);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
