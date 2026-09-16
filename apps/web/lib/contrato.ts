import { Contract, JsonRpcProvider, Wallet, isHexString } from "ethers";
import type { OpcionVoto, ResultadoPropuesta } from "@civora/shared-types";
import despliegue from "./generated/despliegue-localhost.json";

/** Orden del enum `Opcion` en VotacionAnonima.sol: AFavor=0, EnContra=1, Abstencion=2. */
export const OPCIONES: OpcionVoto[] = ["a_favor", "en_contra", "abstencion"];

/**
 * Conexion server-side al contrato VotacionAnonima en el nodo Hardhat
 * local. Genera despliegue-localhost.json el script
 * packages/contracts/scripts/deploy.js (ver README): si falta este
 * archivo, ejecuta `pnpm --filter @civora/contracts node` y, en otra
 * terminal, `pnpm --filter @civora/contracts deploy:localhost`.
 *
 * El servidor firma las transacciones con una cuenta de prueba de Hardhat
 * (well-known, nunca usar fuera de un nodo local): el votante todavia no
 * tiene wallet propia (identificacion real via zk-identity pendiente), asi
 * que el backend actua de "relayer" pagando el gas por el.
 */
const RPC_URL_HARDHAT_LOCAL = "http://127.0.0.1:8545";
const CLAVE_HARDHAT_LOCAL = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const RPC_URL = process.env.HARDHAT_RPC_URL ?? RPC_URL_HARDHAT_LOCAL;

if (RPC_URL !== RPC_URL_HARDHAT_LOCAL && !process.env.HARDHAT_RELAYER_PRIVATE_KEY) {
  throw new Error(
    "HARDHAT_RPC_URL apunta fuera de localhost: define tambien HARDHAT_RELAYER_PRIVATE_KEY, " +
      "no uses la clave de prueba de Hardhat en una red real."
  );
}

const CLAVE_RELAYER = process.env.HARDHAT_RELAYER_PRIVATE_KEY ?? CLAVE_HARDHAT_LOCAL;

const provider = new JsonRpcProvider(RPC_URL);
const relayer = new Wallet(CLAVE_RELAYER, provider);

export const PROPUESTA_ID_BYTES32 = despliegue.propuestaIdBytes32;

export function contratoLectura(): Contract {
  return new Contract(despliegue.address, despliegue.abi, provider);
}

export function contratoEscritura(): Contract {
  return new Contract(despliegue.address, despliegue.abi, relayer);
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
    propuestaId: despliegue.propuestaId,
    registrados: Number(aFavor + enContra + abstenciones),
    aFavor: Number(aFavor),
    enContra: Number(enContra),
    abstenciones: Number(abstenciones),
  };
}
