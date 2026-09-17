const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const VotacionAnonima = await hre.ethers.getContractFactory("VotacionAnonima");
  // Verificador ZK real pendiente (ver docs/modelo-amenazas.md): se usa la
  // direccion del propio deployer como placeholder, sin efecto todavia
  // porque el contrato aun no llama al verificador.
  const contrato = await VotacionAnonima.deploy(deployer.address);
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
