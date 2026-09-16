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
 */
const RPC_URL_HARDHAT_LOCAL = "http://127.0.0.1:8545";
const CLAVE_HARDHAT_LOCAL = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** Debe coincidir con PROPUESTA_ID en packages/contracts/scripts/deploy.js */
const PROPUESTA_ID = "b3f1a2c4-4d5e-4a6b-8c7d-9e0f1a2b3c4d";

const RPC_URL = process.env.HARDHAT_RPC_URL ?? RPC_URL_HARDHAT_LOCAL;

if (RPC_URL !== RPC_URL_HARDHAT_LOCAL && !process.env.HARDHAT_RELAYER_PRIVATE_KEY) {
  throw new Error(
    "HARDHAT_RPC_URL apunta fuera de localhost: define tambien HARDHAT_RELAYER_PRIVATE_KEY, " +
      "no uses la clave de prueba de Hardhat en una red real."
  );
}

let direccionContrato: string;
let propuestaId: string;

if (process.env.CONTRATO_DIRECCION) {
  direccionContrato = process.env.CONTRATO_DIRECCION;
  propuestaId = PROPUESTA_ID;
} else {
  const rutaDespliegue = path.join(process.cwd(), "lib", "generated", "despliegue-localhost.json");
  if (!fs.existsSync(rutaDespliegue)) {
    throw new Error(
      "Falta lib/generated/despliegue-localhost.json: ejecuta `pnpm --filter @civora/contracts node` " +
        "y `pnpm --filter @civora/contracts deploy:localhost`, o define CONTRATO_DIRECCION para usar una red publica."
    );
  }
  const despliegue = JSON.parse(fs.readFileSync(rutaDespliegue, "utf8"));
  direccionContrato = despliegue.address;
  propuestaId = despliegue.propuestaId;
}

const CLAVE_RELAYER = process.env.HARDHAT_RELAYER_PRIVATE_KEY ?? CLAVE_HARDHAT_LOCAL;

const provider = new JsonRpcProvider(RPC_URL);
const relayer = new Wallet(CLAVE_RELAYER, provider);

export const PROPUESTA_ID_BYTES32 = ethersId(propuestaId);

export function contratoLectura(): Contract {
  return new Contract(direccionContrato, abi, provider);
}

export function contratoEscritura(): Contract {
  return new Contract(direccionContrato, abi, relayer);
}

export function nullifierABytes32(nullifierHex: string): string {
  const conPrefijo = nullifierHex.startsWith("0x") ? nullifierHex : `0x${nullifierHex}`;
  if (!isHexString(conPrefijo, 32)) {
    throw new Error("El nullifier debe ser un hash de 32 bytes en hexadecimal");
  }
  return conPrefijo;
}

export async function leerResultados(): Promise<ResultadoPropuesta> {
  const contrato = contratoLectura();
  const [aFavor, enContra, abstenciones]: bigint[] = await contrato.resultados(
    PROPUESTA_ID_BYTES32
  );
  return {
    propuestaId,
    registrados: Number(aFavor + enContra + abstenciones),
    aFavor: Number(aFavor),
    enContra: Number(enContra),
    abstenciones: Number(abstenciones),
  };
}
