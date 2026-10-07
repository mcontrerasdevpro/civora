import { id as ethersId, type EventLog, type Provider } from "ethers";
import type { Propuesta } from "@civora/shared-types";
import { contratoLectura, direccionContrato, propuestaIdBytes32 } from "./contrato";
import {
  FIRMA_VOTO_EMITIDO,
  primerBloqueDesde,
  rangosDeBloques,
  recontarEventos,
  type EventoVoto,
  type VotosPorVia,
} from "./recuento-eventos.mjs";
import { registrarError } from "./registro.mjs";

/**
 * Datos públicos para que cualquiera compruebe el resultado de una propuesta
 * cerrada: el contrato, el evento que hay que contar, el rango de bloques y,
 * si el proveedor RPC lo permite, el recuento rehecho desde los eventos con
 * su desglose por vía y las transacciones de cada voto.
 *
 * Solo se calcula tras el cierre: a partir de ahí el contrato no admite más
 * votos, así que el resultado se guarda en memoria y no se vuelve a leer.
 *
 * Configuración (variables de entorno, ninguna obligatoria):
 *   EXPLORADOR_URL          explorador de bloques de la red, p. ej. el de
 *                           Sepolia; sin ella no se enlazan transacciones
 *   RPC_MAX_BLOQUES_LOGS    bloques por consulta eth_getLogs (por defecto 10,
 *                           el límite del plan gratuito de Alchemy)
 *   RPC_MAX_CONSULTAS_LOGS  consultas máximas por propuesta (por defecto 500)
 */

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
    }
  | { disponible: false; motivo: "rango" | "error" };

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
const REINTENTO_TRAS_FALLO_MS = 60_000;

function entero(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
}

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

const cache = new Map<string, { valor: Promise<VerificacionResultados>; caduca: number }>();

export function verificacionResultados(propuesta: Propuesta): Promise<VerificacionResultados> {
  const guardada = cache.get(propuesta.id);
  if (guardada && guardada.caduca > Date.now()) return guardada.valor;

  const valor = calcular(propuesta).then((resultado) => {
    // Un recuento completo es definitivo; si falló, se reintenta más tarde.
    cache.set(propuesta.id, {
      valor: Promise.resolve(resultado),
      caduca: resultado.recuento.disponible ? Number.POSITIVE_INFINITY : Date.now() + REINTENTO_TRAS_FALLO_MS,
    });
    return resultado;
  });
  cache.set(propuesta.id, { valor, caduca: Date.now() + REINTENTO_TRAS_FALLO_MS });
  return valor;
}

async function calcular(propuesta: Propuesta): Promise<VerificacionResultados> {
  const contrato = contratoLectura();
  const idBytes32 = propuestaIdBytes32(propuesta.id);
  const base: Omit<VerificacionResultados, "bloques" | "recuento"> = {
    contrato: direccionContrato(),
    explorador: urlExplorador(),
    propuestaIdBytes32: idBytes32,
    firmaEvento: FIRMA_VOTO_EMITIDO,
    topicEvento: ethersId(FIRMA_VOTO_EMITIDO),
  };

  let bloques: { desde: number; hasta: number } | null = null;
  try {
    const proveedor = contrato.runner as Provider;
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
    bloques = { desde, hasta };

    const rangos = rangosDeBloques(desde, hasta, entero(process.env.RPC_MAX_BLOQUES_LOGS, 10));
    const maxConsultas = entero(process.env.RPC_MAX_CONSULTAS_LOGS, 500);
    if (rangos.length > maxConsultas) {
      return { ...base, bloques, recuento: { disponible: false, motivo: "rango" } };
    }

    const filtro = contrato.filters.VotoEmitido(idBytes32);
    const registros: EventLog[] = [];
    for (const [inicio, fin] of rangos) {
      const lote = await contrato.queryFilter(filtro, inicio, fin);
      registros.push(...lote.filter((r): r is EventLog => "args" in r));
    }

    // La vía se deduce de la función de la transacción que emitió cada voto.
    const hashes = [...new Set(registros.map((r) => r.transactionHash))];
    const selectores = new Map<string, string | null>();
    let leerVia = hashes.length <= maxConsultas;
    if (leerVia) {
      for (const hash of hashes) {
        const tx = await proveedor.getTransaction(hash);
        if (!tx) {
          leerVia = false;
          break;
        }
        const alContrato = tx.to?.toLowerCase() === base.contrato.toLowerCase();
        selectores.set(hash, alContrato ? tx.data.slice(0, 10) : null);
      }
    }

    const eventos: EventoVoto[] = registros.map((r) => ({
      opcion: Number(r.args.opcion),
      nullifier: String(r.args.nullifier),
      selector: selectores.get(r.transactionHash) ?? null,
    }));
    const recuento = recontarEventos(
      eventos,
      leerVia
        ? {
            certificado: contrato.interface.getFunction("votarManual")!.selector,
            zk: contrato.interface.getFunction("votarConPruebaZk")!.selector,
          }
        : null
    );

    return {
      ...base,
      bloques,
      recuento: {
        disponible: true,
        ...recuento,
        transacciones: hashes.slice(0, MAX_TRANSACCIONES_RESPUESTA),
        totalTransacciones: hashes.length,
      },
    };
  } catch (error) {
    // Nunca el objeto: el error de ethers incluye la consulta RPC.
    registrarError("recuento por eventos no disponible", error);
    return { ...base, bloques, recuento: { disponible: false, motivo: "error" } };
  }
}
