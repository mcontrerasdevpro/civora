const { expect } = require("chai");
const { ethers } = require("hardhat");
const { obtenerConfiguracionDespliegue } = require("../scripts/deployment-config");

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
  describe("configuracion de despliegue", function () {
    it("desactiva demo por defecto en local y permite activarla explícitamente", function () {
      const configuracion = obtenerConfiguracionDespliegue("localhost", {}, "0x0000000000000000000000000000000000000001");

      expect(configuracion.devModeZk).to.equal(false);
      expect(configuracion.dominioZk).to.equal(DOMINIO_ZK);
      expect(configuracion.relayerAddress).to.equal("0x0000000000000000000000000000000000000001");

      expect(
        obtenerConfiguracionDespliegue(
          "hardhat",
          { ZKPASSPORT_DEV_MODE: "true" },
          "0x0000000000000000000000000000000000000001"
        ).devModeZk
      ).to.equal(true);
    });

    it("falla en red publica si falta dominio propio, modo seguro explícito o relayer", function () {
      const base = { ZKPASSPORT_DOMAIN: "votos.ejemplo.es", ZKPASSPORT_DEV_MODE: "false", RELAYER_ADDRESS: "0x0000000000000000000000000000000000000001" };

      expect(() => obtenerConfiguracionDespliegue("sepolia", {}, base.RELAYER_ADDRESS)).to.throw("ZKPASSPORT_DOMAIN");
      expect(() => obtenerConfiguracionDespliegue("sepolia", { ...base, ZKPASSPORT_DEV_MODE: undefined }, base.RELAYER_ADDRESS)).to.throw("ZKPASSPORT_DEV_MODE=false");
      expect(() => obtenerConfiguracionDespliegue("sepolia", { ...base, RELAYER_ADDRESS: undefined }, base.RELAYER_ADDRESS)).to.throw("RELAYER_ADDRESS");
    });

    it("permite la demo pública solo en Sepolia con opt-in y DEV_MODE explícito", function () {
      const relayer = "0x0000000000000000000000000000000000000001";
      const demo = { CIVORA_DEMO_TESTNET: "true", ZKPASSPORT_DEV_MODE: "true", RELAYER_ADDRESS: relayer };

      const configuracion = obtenerConfiguracionDespliegue("sepolia", demo, relayer, 11155111n);
      expect(configuracion.devModeZk).to.equal(true);
      expect(configuracion.dominioZk).to.equal(DOMINIO_ZK);
      expect(configuracion.demoTestnet).to.equal(true);
      expect(configuracion.relayerAddress).to.equal(relayer);

      expect(() => obtenerConfiguracionDespliegue("mainnet", demo, relayer, 1n)).to.throw("solo se permite en Sepolia");
      expect(() => obtenerConfiguracionDespliegue("base", demo, relayer, 8453n)).to.throw("solo se permite en Sepolia");
      expect(() => obtenerConfiguracionDespliegue("sepolia", demo, relayer, undefined)).to.throw("solo se permite en Sepolia");
      expect(() =>
        obtenerConfiguracionDespliegue("sepolia", { ...demo, ZKPASSPORT_DEV_MODE: undefined }, relayer, 11155111n)
      ).to.throw("de forma explícita");
      expect(() =>
        obtenerConfiguracionDespliegue("sepolia", { ...demo, RELAYER_ADDRESS: undefined }, relayer, 11155111n)
      ).to.throw("RELAYER_ADDRESS");
      // Cualquier valor distinto de "true" no activa la excepción: vuelve a exigir dominio propio.
      expect(() =>
        obtenerConfiguracionDespliegue("sepolia", { ...demo, CIVORA_DEMO_TESTNET: "1" }, relayer, 11155111n)
      ).to.throw("ZKPASSPORT_DOMAIN");
    });

    it("acepta solo una configuración pública explícita y segura", function () {
      const configuracion = obtenerConfiguracionDespliegue(
        "sepolia",
        { ZKPASSPORT_DOMAIN: "votos.ejemplo.es", ZKPASSPORT_DEV_MODE: "false", RELAYER_ADDRESS: "0x0000000000000000000000000000000000000001" },
        "0x0000000000000000000000000000000000000002"
      );

      expect(configuracion.devModeZk).to.equal(false);
      expect(configuracion.relayerAddress).to.equal("0x0000000000000000000000000000000000000001");
    });
  });

  async function desplegar({ devModeZk = true } = {}) {
    const [relayer, atacante] = await ethers.getSigners();

    const MockRootVerifier = await ethers.getContractFactory("MockRootVerifier");
    const mock = await MockRootVerifier.deploy();
    await mock.waitForDeployment();

    const Factory = await ethers.getContractFactory("VotacionAnonima");
    const contrato = await Factory.deploy(await mock.getAddress(), DOMINIO_ZK, devModeZk, relayer.address);
    await contrato.waitForDeployment();

    const propuestaIdTexto = "propuesta-demo";
    const propuestaId = ethers.id(propuestaIdTexto);
    const bloque = await ethers.provider.getBlock("latest");
    const apertura = bloque.timestamp;
    const cierre = apertura + 3600;
    await (await contrato.crearPropuesta(propuestaId, ethers.id("contenido"), apertura, cierre)).wait();

    return { contrato, mock, propuestaId, propuestaIdTexto, apertura, cierre, relayer, atacante };
  }

  it("rechaza la dirección cero como verificador o como relayer", async function () {
    const [relayer] = await ethers.getSigners();
    const mock = await (await ethers.getContractFactory("MockRootVerifier")).deploy();
    const Factory = await ethers.getContractFactory("VotacionAnonima");

    await expect(
      Factory.deploy(ethers.ZeroAddress, DOMINIO_ZK, false, relayer.address)
    ).to.be.revertedWithCustomError(Factory, "DireccionCero");
    await expect(
      Factory.deploy(await mock.getAddress(), DOMINIO_ZK, false, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(Factory, "DireccionCero");
  });

  it("fija el relayer y restringe la creacion de propuestas", async function () {
    const { contrato, propuestaId, atacante, relayer } = await desplegar();

    expect(await contrato.relayer()).to.equal(relayer.address);
    await expect(
      contrato.connect(atacante).crearPropuesta(propuestaId, ethers.id("otra"), 1, 2)
    ).to.be.revertedWithCustomError(contrato, "SoloRelayer");
  });

  describe("votarManual", function () {
    it("rechaza votos manuales que no firma el relayer", async function () {
      const { contrato, propuestaId, atacante } = await desplegar();

      await expect(
        contrato.connect(atacante).votarManual(propuestaId, ethers.id("documento-1"), 0, "0x")
      ).to.be.revertedWithCustomError(contrato, "SoloRelayer");
    });

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
