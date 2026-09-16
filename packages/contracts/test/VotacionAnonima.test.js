const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotacionAnonima", function () {
  async function desplegar() {
    const [deployer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VotacionAnonima");
    const contrato = await Factory.deploy(deployer.address);
    await contrato.waitForDeployment();

    const propuestaId = ethers.id("propuesta-demo");
    await (await contrato.crearPropuesta(propuestaId, ethers.id("contenido"), 3600)).wait();

    return { contrato, propuestaId };
  }

  it("cuenta un voto y lo hace consultable por nullifier", async function () {
    const { contrato, propuestaId } = await desplegar();
    const nullifier = ethers.id("documento-1");

    await (await contrato.votar(propuestaId, nullifier, 0, "0x")).wait();

    const [aFavor, enContra, abstenciones] = await contrato.resultados(propuestaId);
    expect(aFavor).to.equal(1n);
    expect(enContra).to.equal(0n);
    expect(abstenciones).to.equal(0n);

    const [registrado, opcion] = await contrato.votoDe(propuestaId, nullifier);
    expect(registrado).to.equal(true);
    expect(opcion).to.equal(0n);
  });

  it("rechaza un segundo voto con el mismo nullifier", async function () {
    const { contrato, propuestaId } = await desplegar();
    const nullifier = ethers.id("documento-1");

    await (await contrato.votar(propuestaId, nullifier, 0, "0x")).wait();

    await expect(contrato.votar(propuestaId, nullifier, 1, "0x")).to.be.revertedWith(
      "Este documento ya ha votado en esta propuesta"
    );
  });

  it("rechaza votos en una propuesta inexistente", async function () {
    const { contrato } = await desplegar();
    const otraPropuesta = ethers.id("no-existe");
    const nullifier = ethers.id("documento-2");

    await expect(contrato.votar(otraPropuesta, nullifier, 0, "0x")).to.be.revertedWith(
      "Propuesta inexistente"
    );
  });

  it("permite votar distintas opciones y las tallya por separado", async function () {
    const { contrato, propuestaId } = await desplegar();

    await (await contrato.votar(propuestaId, ethers.id("doc-a"), 0, "0x")).wait();
    await (await contrato.votar(propuestaId, ethers.id("doc-b"), 1, "0x")).wait();
    await (await contrato.votar(propuestaId, ethers.id("doc-c"), 2, "0x")).wait();

    const [aFavor, enContra, abstenciones] = await contrato.resultados(propuestaId);
    expect(aFavor).to.equal(1n);
    expect(enContra).to.equal(1n);
    expect(abstenciones).to.equal(1n);
  });
});
