import fs from "fs";
import path from "path";
import { Contract, JsonRpcProvider, Wallet, id as ethersId, isHexString } from "ethers";
import type { OpcionVoto, ResultadoPropuesta } from "@civora/shared-types";
import abi from "./votacion-anonima-abi.json";

/** Orden del enum `Opcion` en VotacionAnonima.sol: AFavor=0, EnContra=1, Abstencion=2. */
export const OPCIONES: OpcionVoto[] = ["a_favor", "en_contra", "abstencion"];

/**
 * Conexion server-side al contrato VotacionAnonima.
 *
 * En local (por defecto) lee la direccion generada por
 * packages/contracts/scripts/deploy.js contra un nodo Hardhat: si falta
 * ese archivo, ejecuta `pnpm --filter @civora/contracts node` y, en otra
 * terminal, `pnpm --filter @civora/contracts deploy:localhost`.
 *
 * En una red publica (Sepolia, etc.) no se versiona el despliegue: se fija
 * la direccion via CONTRATO_DIRECCION (ver deploy:sepolia, que la imprime).
 *
 * El servidor firma las transacciones con una cuenta que actua de
 * "relayer" pagando el gas: el votante todavia no tiene wallet propia
 * (identificacion real via zk-identity pendiente). En local se usa una
 * cuenta de prueba de Hardhat (well-known, nunca usar fuera de un nodo
 * local); en cualquier otra red hay que definir HARDHAT_RELAYER_PRIVATE_KEY.
 *
 * Las propuestas ya no son un dato fijo del despliegue: cada una se crea
 * dinamicamente (ver app/api/propuestas) y se identifica por su propio uuid,
 * que aqui se convierte a bytes32 con `propuestaIdBytes32`.
 */
const RPC_URL_HARDHAT_LOCAL = "http://127.0.0.1:8545";
const CLAVE_HARDHAT_LOCAL = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type Conexion = { direccion: string; provider: JsonRpcProvider; relayer: Wallet };

let conexion: Conexion | null = null;

/**
 * La configuración se resuelve en el primer uso y no al importar el módulo:
 * así `next build` (y la imagen Docker) no necesita CONTRATO_DIRECCION ni el
 * despliegue local, y los errores de configuración aparecen al atender la
 * primera petición que usa el contrato.
 */
function obtenerConexion(): Conexion {
  if (conexion) return conexion;

  const rpcUrl = process.env.HARDHAT_RPC_URL ?? RPC_URL_HARDHAT_LOCAL;
  if (rpcUrl !== RPC_URL_HARDHAT_LOCAL && !process.env.HARDHAT_RELAYER_PRIVATE_KEY) {
    throw new Error(
      "HARDHAT_RPC_URL apunta fuera de localhost: define tambien HARDHAT_RELAYER_PRIVATE_KEY, " +
        "no uses la clave de prueba de Hardhat en una red real."
    );
  }

  let direccion: string;
  if (process.env.CONTRATO_DIRECCION) {
    direccion = process.env.CONTRATO_DIRECCION;
  } else {
    const rutaDespliegue = path.join(process.cwd(), "lib", "generated", "despliegue-localhost.json");
    if (!fs.existsSync(rutaDespliegue)) {
      throw new Error(
        "Falta lib/generated/despliegue-localhost.json: ejecuta `pnpm --filter @civora/contracts node` " +
          "y `pnpm --filter @civora/contracts deploy:localhost`, o define CONTRATO_DIRECCION para usar una red publica."
      );
    }
    direccion = JSON.parse(fs.readFileSync(rutaDespliegue, "utf8")).address;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const relayer = new Wallet(process.env.HARDHAT_RELAYER_PRIVATE_KEY ?? CLAVE_HARDHAT_LOCAL, provider);
  conexion = { direccion, provider, relayer };
  return conexion;
}

/** Dirección del contrato que usa este servidor (CONTRATO_DIRECCION o el despliegue local). */
export function direccionContrato(): string {
  return obtenerConexion().direccion;
}

export function propuestaIdBytes32(propuestaId: string): string {
  return ethersId(propuestaId);
}

export function contratoLectura(): Contract {
  const { direccion, provider } = obtenerConexion();
  return new Contract(direccion, abi, provider);
}

export function contratoEscritura(): Contract {
  const { direccion, relayer } = obtenerConexion();
  return new Contract(direccion, abi, relayer);
}

export function nullifierABytes32(nullifierHex: string): string {
  const conPrefijo = nullifierHex.startsWith("0x") ? nullifierHex : `0x${nullifierHex}`;
  if (!isHexString(conPrefijo, 32)) {
    throw new Error("El nullifier debe ser un hash de 32 bytes en hexadecimal");
  }
  return conPrefijo;
}

/** Índices del enum Via de VotacionAnonima.sol (ADR 0021). */
const INDICE_VIA = { certificado: 0, zk: 1, ambas: 2 } as const;

/** Selector de ViaNoPermitida(): el contrato rechaza la vía de esa propuesta. */
export const SELECTOR_VIA_NO_PERMITIDA = ethersId("ViaNoPermitida()").slice(0, 10);

export async function crearPropuestaOnChain(params: {
  propuestaId: string;
  contenidoHash: string;
  fechaApertura: string;
  fechaCierre: string;
  via: keyof typeof INDICE_VIA;
}): Promise<{ txHash: string }> {
  const contrato = contratoEscritura();
  const apertura = Math.floor(new Date(params.fechaApertura).getTime() / 1000);
  const cierre = Math.floor(new Date(params.fechaCierre).getTime() / 1000);
  const tx = await contrato.crearPropuesta(
    propuestaIdBytes32(params.propuestaId),
    params.contenidoHash,
    apertura,
    cierre,
    INDICE_VIA[params.via]
  );
  await tx.wait();
  return { txHash: tx.hash };
}

/**
 * Ethers no decodifica solo los errores personalizados de Solidity
 * (PruebaInvalida, NacionalidadNoValida...): el selector de 4 bytes llega en
 * `error.data` (o anidado en `error.info.error.data`, segun el proveedor
 * RPC). Aqui se decodifica contra el ABI del propio contrato y se relanza
 * como un Error normal con el nombre tal cual, para que el resto del codigo
 * (p.ej. las rutas API) lo distinga por texto igual que un require() normal.
 */
function relanzarErrorDecodificado(error: unknown, contrato: Contract): never {
  const bruto = error as { data?: unknown; info?: { error?: { data?: unknown } } };
  const candidato = bruto.data ?? bruto.info?.error?.data;
  const selector = typeof candidato === "string" ? candidato : (candidato as { data?: string })?.data;

  if (typeof selector === "string") {
    let decodificado = null;
    try {
      decodificado = contrato.interface.parseError(selector);
    } catch {
      // no era un error del ABI de este contrato; se relanza el original
    }
    if (decodificado) throw new Error(decodificado.name);
  }
  throw error;
}

/**
 * Envia un voto verificado on-chain: el contrato verifica la prueba contra
 * el RootVerifier oficial de ZKPassport dentro de la misma transaccion (ver
 * VotacionAnonima.votarConPruebaZk) y usa el identificador que esa prueba
 * entrega como nullifier. Aqui no se verifica ni se calcula ningun
 * nullifier: solo se relaya la transaccion y se lee el que el contrato
 * emitio en el evento VotoEmitido.
 */
export async function votarConPruebaZkOnChain(params: {
  propuestaId: string;
  opcionIndex: number;
  parametrosVerificacion: unknown;
}): Promise<{ nullifier: string }> {
  const contrato = contratoEscritura();
  let recibo;
  try {
    const tx = await contrato.votarConPruebaZk(
      params.propuestaId,
      params.opcionIndex,
      params.parametrosVerificacion
    );
    recibo = await tx.wait();
  } catch (error) {
    relanzarErrorDecodificado(error, contrato);
  }

  for (const log of recibo.logs) {
    try {
      const evento = contrato.interface.parseLog(log);
      if (evento?.name === "VotoEmitido") {
        return { nullifier: evento.args.nullifier as string };
      }
    } catch {
      // log de otro contrato/evento; se ignora
    }
  }
  throw new Error("El voto se envio pero no se pudo leer el nullifier del recibo.");
}

export async function leerResultados(propuestaId: string): Promise<ResultadoPropuesta> {
  const contrato = contratoLectura();
  const [aFavor, enContra, abstenciones]: bigint[] = await contrato.resultados(
    propuestaIdBytes32(propuestaId)
  );
  return {
    propuestaId,
    registrados: Number(aFavor + enContra + abstenciones),
    aFavor: Number(aFavor),
    enContra: Number(enContra),
    abstenciones: Number(abstenciones),
  };
}
