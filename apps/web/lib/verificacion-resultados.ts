import { id as ethersId, type Provider } from "ethers";
import type { Propuesta } from "@civora/shared-types";
import { contratoLectura, direccionContrato, leerResultados, propuestaIdBytes32 } from "./contrato";
import { asegurarEsquemaEventos, query } from "./db";
import { indexadorHabilitado, leerEstadoIndice } from "./indexador-eventos";
import {
  FIRMA_VOTO_EMITIDO,
  mismoRecuento,
  primerBloqueDesde,
  recontarEventos,
  type VotosPorVia,
} from "./recuento-eventos.mjs";
import { registrarError } from "./registro.mjs";

/**
 * Datos públicos para que cualquiera compruebe el resultado de una propuesta
 * cerrada: el contrato, el evento que hay que contar, el rango de bloques y
 * el recuento rehecho desde los eventos.
 *
 * Los eventos salen del índice de civora-db (ADR 0020), que es solo una
 * copia de la cadena. Por eso el recuento rehecho se compara **siempre** con
 * el que guarda el contrato, aquí, en el servidor: si no coincide, se
 * devuelve como discrepancia, nunca se oculta.
 *
 * EXPLORADOR_URL: explorador de bloques de la red (solo https); sin ella no
 * se enlazan transacciones.
 */

type Recuento = { aFavor: number; enContra: number; abstenciones: number };

export type RecuentoVerificado =
  | {
      disponible: true;
      aFavor: number;
      enContra: number;
      abstenciones: number;
      total: number;
      porVia: VotosPorVia | null;
      duplicados: number;
      transacciones: string[];
      totalTransacciones: number;
      contrato: Recuento;
      coincide: boolean;
      indiceHastaBloque: number;
    }
  | { disponible: false; motivo: "indexando"; indiceHastaBloque: number | null }
  | { disponible: false; motivo: "sin_indice" | "error" };

export interface VerificacionResultados {
  contrato: string;
  explorador: string | null;
  propuestaIdBytes32: string;
  firmaEvento: string;
  topicEvento: string;
  bloques: { desde: number; hasta: number } | null;
  recuento: RecuentoVerificado;
}

const MAX_TRANSACCIONES_RESPUESTA = 200;

/** Explorador configurado, solo https y sin barra final. */
export function urlExplorador(valor = process.env.EXPLORADOR_URL): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" ? url.toString().replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

// Bloques de cada votación: tras el cierre no cambian.
const bloquesPorPropuesta = new Map<string, { desde: number; hasta: number }>();

async function bloquesDeLaVotacion(propuesta: Propuesta): Promise<{ desde: number; hasta: number } | null> {
  const guardados = bloquesPorPropuesta.get(propuesta.id);
  if (guardados) return guardados;
  try {
    const proveedor = contratoLectura().runner as Provider;
    const timestamps = new Map<number, number>();
    const timestampDe = async (numero: number) => {
      const conocido = timestamps.get(numero);
      if (conocido !== undefined) return conocido;
      const bloque = await proveedor.getBlock(numero);
      if (!bloque) throw new Error("BLOQUE_INEXISTENTE");
      timestamps.set(numero, bloque.timestamp);
      return bloque.timestamp;
    };
    const ultimo = await proveedor.getBlockNumber();
    const apertura = Math.floor(Date.parse(propuesta.fechaApertura) / 1000);
    const cierre = Math.floor(Date.parse(propuesta.fechaCierre) / 1000);
    const desde = await primerBloqueDesde(timestampDe, 0, ultimo, apertura);
    // El contrato solo admite votos con timestamp < cierre.
    const hasta = Math.max(desde, (await primerBloqueDesde(timestampDe, desde, ultimo, cierre)) - 1);
    const bloques = { desde, hasta };
    bloquesPorPropuesta.set(propuesta.id, bloques);
    return bloques;
  } catch (error) {
    registrarError("bloques de la votación no disponibles", error);
    return null;
  }
}

async function recuentoDesdeIndice(propuesta: Propuesta, contrato: string, idBytes32: string): Promise<RecuentoVerificado> {
  if (!indexadorHabilitado()) return { disponible: false, motivo: "sin_indice" };

  const estado = await leerEstadoIndice(contrato);
  const cierre = Math.floor(Date.parse(propuesta.fechaCierre) / 1000);
  // Completo solo si el índice ha pasado ya del cierre: después no hay votos.
  if (!estado || estado.ultimoTimestamp < cierre) {
    return { disponible: false, motivo: "indexando", indiceHastaBloque: estado?.ultimoBloque ?? null };
  }

  await asegurarEsquemaEventos();
  const filas = await query<{ tx_hash: string; nullifier: string; opcion: number; selector: string | null }>(
    `SELECT tx_hash, nullifier, opcion, selector FROM eventos_voto
     WHERE contrato = $1 AND propuesta_id = $2
     ORDER BY bloque, indice_log`,
    [contrato.toLowerCase(), idBytes32.toLowerCase()]
  );
  const instancia = contratoLectura();
  const recuento = recontarEventos(
    filas.map((f) => ({ opcion: Number(f.opcion), nullifier: f.nullifier, selector: f.selector })),
    {
      certificado: instancia.interface.getFunction("votarManual")!.selector,
      zk: instancia.interface.getFunction("votarConPruebaZk")!.selector,
    }
  );
  const delContrato = await leerResultados(propuesta.id);
  const hashes = [...new Set(filas.map((f) => f.tx_hash))];

  return {
    disponible: true,
    ...recuento,
    transacciones: hashes.slice(0, MAX_TRANSACCIONES_RESPUESTA),
    totalTransacciones: hashes.length,
    contrato: { aFavor: delContrato.aFavor, enContra: delContrato.enContra, abstenciones: delContrato.abstenciones },
    coincide: mismoRecuento(recuento, delContrato) && recuento.duplicados === 0,
    indiceHastaBloque: estado.ultimoBloque,
  };
}

export async function verificacionResultados(propuesta: Propuesta): Promise<VerificacionResultados> {
  const contrato = direccionContrato();
  const idBytes32 = propuestaIdBytes32(propuesta.id);
  const base = {
    contrato,
    explorador: urlExplorador(),
    propuestaIdBytes32: idBytes32,
    firmaEvento: FIRMA_VOTO_EMITIDO,
    topicEvento: ethersId(FIRMA_VOTO_EMITIDO),
  };

  let recuento: RecuentoVerificado;
  try {
    recuento = await recuentoDesdeIndice(propuesta, contrato, idBytes32);
  } catch (error) {
    // Nunca el objeto: el error de ethers o de pg incluye la consulta.
    registrarError("verificación por eventos no disponible", error);
    recuento = { disponible: false, motivo: "error" };
  }
  return { ...base, bloques: await bloquesDeLaVotacion(propuesta), recuento };
}
