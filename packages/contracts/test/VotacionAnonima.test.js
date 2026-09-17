const { expect } = require("chai");
const { ethers } = require("hardhat");

const DOMINIO_ZK = "demo.zkpassport.id";

function paramsVacios(overrides = {}) {
  return {
    version: ethers.ZeroHash,
    proofVerificationData: {
      vkeyHash: ethers.ZeroHash,
      proof: "0x",
      publicInputs: [],
    },
    committedInputs: "0x",
    serviceConfig: {
      validityPeriodInSeconds: 604800,
      domain: DOMINIO_ZK,
      scope: "",
      devMode: true,
    },
    ...overrides,
  };
}

describe("VotacionAnonima", function () {
  async function desplegar({ devModeZk = true } = {}) {
    const [deployer] = await ethers.getSigners();

    const MockRootVerifier = await ethers.getContractFactory("MockRootVerifier");
    const mock = await MockRootVerifier.deploy();
    await mock.waitForDeployment();

    const Factory = await ethers.getContractFactory("VotacionAnonima");
    const contrato = await Factory.deploy(await mock.getAddress(), DOMINIO_ZK, devModeZk);
    await contrato.waitForDeployment();

    const propuestaIdTexto = "propuesta-demo";
    const propuestaId = ethers.id(propuestaIdTexto);
    const bloque = await ethers.provider.getBlock("latest");
    const apertura = bloque.timestamp;
    const cierre = apertura + 3600;
    await (await contrato.crearPropuesta(propuestaId, ethers.id("contenido"), apertura, cierre)).wait();

    return { contrato, mock, propuestaId, propuestaIdTexto, apertura, cierre };
  }

  describe("votarManual", function () {
    it("cuenta un voto y lo hace consultable por nullifier", async function () {
      const { contrato, propuestaId } = await desplegar();
      const nullifier = ethers.id("documento-1");

      await (await contrato.votarManual(propuestaId, nullifier, 0, "0x")).wait();

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

      await (await contrato.votarManual(propuestaId, nullifier, 0, "0x")).wait();

      await expect(contrato.votarManual(propuestaId, nullifier, 1, "0x")).to.be.revertedWith(
        "Este documento ya ha votado en esta propuesta"
      );
    });

    it("rechaza votos antes de la apertura", async function () {
      const { contrato, mock } = await desplegar();
      const propuestaIdTexto = "propuesta-futura";
      const propuestaId = ethers.id(propuestaIdTexto);
      const bloque = await ethers.provider.getBlock("latest");
      const apertura = bloque.timestamp + 3600;
      const cierre = apertura + 3600;
      await (await contrato.crearPropuesta(propuestaId, ethers.id("contenido"), apertura, cierre)).wait();
      mock; // solo para reusar el contrato ya desplegado

      await expect(contrato.votarManual(propuestaId, ethers.id("documento-1"), 0, "0x")).to.be.revertedWith(
        "La votacion todavia no ha comenzado"
      );
    });

    it("rechaza votos en una propuesta inexistente", async function () {
      const { contrato } = await desplegar();
      const otraPropuesta = ethers.id("no-existe");
      const nullifier = ethers.id("documento-2");

      await expect(contrato.votarManual(otraPropuesta, nullifier, 0, "0x")).to.be.revertedWith(
        "Propuesta inexistente"
      );
    });

    it("permite votar distintas opciones y las tallya por separado", async function () {
      const { contrato, propuestaId } = await desplegar();

      await (await contrato.votarManual(propuestaId, ethers.id("doc-a"), 0, "0x")).wait();
      await (await contrato.votarManual(propuestaId, ethers.id("doc-b"), 1, "0x")).wait();
      await (await contrato.votarManual(propuestaId, ethers.id("doc-c"), 2, "0x")).wait();

      const [aFavor, enContra, abstenciones] = await contrato.resultados(propuestaId);
      expect(aFavor).to.equal(1n);
      expect(enContra).to.equal(1n);
      expect(abstenciones).to.equal(1n);
    });
  });

  describe("votarConPruebaZk", function () {
    async function prepararMockValido(mock, marcaTiempo) {
      const identificador = ethers.id("identificador-unico-1");
      await (
        await mock.fijarResultado(true, identificador, marcaTiempo, true, 18, "ESP")
      ).wait();
      return identificador;
    }

    it("acepta una prueba valida y usa el identificador unico como nullifier", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar();
      const bloque = await ethers.provider.getBlock("latest");
      const identificador = await prepararMockValido(mock, bloque.timestamp);

      await (
        await contrato.votarConPruebaZk(propuestaIdTexto, 0, paramsVacios({ serviceConfig: { ...paramsVacios().serviceConfig, devMode: false } }))
      ).wait();

      const propuestaId = ethers.id(propuestaIdTexto);
      const [registrado, opcion] = await contrato.votoDe(propuestaId, identificador);
      expect(registrado).to.equal(true);
      expect(opcion).to.equal(0n);
    });

    it("rechaza una prueba que el verificador marca como invalida", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar();
      const bloque = await ethers.provider.getBlock("latest");
      await (await mock.fijarResultado(false, ethers.id("x"), bloque.timestamp, true, 18, "ESP")).wait();

      await expect(contrato.votarConPruebaZk(propuestaIdTexto, 0, paramsVacios())).to.be.revertedWithCustomError(
        contrato,
        "PruebaInvalida"
      );
    });

    it("rechaza una prueba con el ambito (scope) incorrecto", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar();
      const bloque = await ethers.provider.getBlock("latest");
      await (await mock.fijarResultado(true, ethers.id("x"), bloque.timestamp, false, 18, "ESP")).wait();

      await expect(contrato.votarConPruebaZk(propuestaIdTexto, 0, paramsVacios())).to.be.revertedWithCustomError(
        contrato,
        "AmbitoIncorrecto"
      );
    });

    it("rechaza una prueba caducada", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar();
      await (await mock.fijarResultado(true, ethers.id("x"), 1, true, 18, "ESP")).wait();

      await expect(contrato.votarConPruebaZk(propuestaIdTexto, 0, paramsVacios())).to.be.revertedWithCustomError(
        contrato,
        "PruebaCaducada"
      );
    });

    it("rechaza una prueba que no llega a la edad minima", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar();
      const bloque = await ethers.provider.getBlock("latest");
      await (await mock.fijarResultado(true, ethers.id("x"), bloque.timestamp, true, 16, "ESP")).wait();

      await expect(contrato.votarConPruebaZk(propuestaIdTexto, 0, paramsVacios())).to.be.revertedWithCustomError(
        contrato,
        "NoCumpleEdadMinima"
      );
    });

    it("rechaza una prueba de otra nacionalidad", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar();
      const bloque = await ethers.provider.getBlock("latest");
      await (await mock.fijarResultado(true, ethers.id("x"), bloque.timestamp, true, 18, "FRA")).wait();

      await expect(contrato.votarConPruebaZk(propuestaIdTexto, 0, paramsVacios())).to.be.revertedWithCustomError(
        contrato,
        "NacionalidadNoValida"
      );
    });

    it("rechaza una prueba en modo desarrollo si el contrato no lo permite", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar({ devModeZk: false });
      const bloque = await ethers.provider.getBlock("latest");
      await prepararMockValido(mock, bloque.timestamp);

      await expect(contrato.votarConPruebaZk(propuestaIdTexto, 0, paramsVacios())).to.be.revertedWithCustomError(
        contrato,
        "ModoDesarrolloNoPermitido"
      );
    });

    it("rechaza un segundo voto con el mismo identificador unico", async function () {
      const { contrato, mock, propuestaIdTexto } = await desplegar();
      const bloque = await ethers.provider.getBlock("latest");
      await prepararMockValido(mock, bloque.timestamp);
      const params = paramsVacios({ serviceConfig: { ...paramsVacios().serviceConfig, devMode: false } });

      await (await contrato.votarConPruebaZk(propuestaIdTexto, 0, params)).wait();

      await expect(contrato.votarConPruebaZk(propuestaIdTexto, 1, params)).to.be.revertedWith(
        "Este documento ya ha votado en esta propuesta"
      );
    });
  });
});
