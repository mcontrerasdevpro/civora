import type { EventLog, Provider } from "ethers";
import { contratoLectura, direccionContrato } from "./contrato";
import { asegurarEsquemaEventos, enTransaccion, query } from "./db";
import { enteroDeEntorno, primerBloqueQueCumple, rangosDelCiclo } from "./recuento-eventos.mjs";
import { registrarAviso, registrarError } from "./registro.mjs";

/**
 * Índice incremental de los eventos públicos VotoEmitido en civora-db
 * (ADR 0020). Cada ciclo lee los bloques nuevos, ya finales, en consultas de
 * como mucho RPC_MAX_BLOQUES_LOGS bloques, y guarda en la misma transacción
 * los eventos y el último bloque procesado. Es solo una copia de la cadena
 * para no repetir consultas: la verificación la compara siempre con el
 * recuento del contrato, y se puede borrar y reconstruir desde cero.
 *
 * Variables (ninguna obligatoria):
 *   INDEXADOR_EVENTOS              "false" lo desactiva
 *   INDEXADOR_INTERVALO_S          segundos entre ciclos (30)
 *   INDEXADOR_CONSULTAS_POR_CICLO  consultas eth_getLogs por ciclo (100)
 *   INDEXADOR_PAUSA_MS             pausa entre consultas (200)
 *   RPC_MAX_BLOQUES_LOGS           bloques por consulta (10, plan gratuito de Alchemy)
 *   CONTRATO_BLOQUE_DESPLIEGUE     bloque desde el que empezar, en decimal; si
 *                                  falta o no es válido, se busca el primero
 *                                  con código en la dirección
 */

const MARGEN_SIN_FINALIZED = 64;
const ESPERA_TRAS_ERROR_MS = 5 * 60_000;

function entero(valor: string | undefined, porDefecto: number): number {
  return enteroDeEntorno(valor, 1) ?? porDefecto;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/** Último bloque final: no se indexa nada que una reorganización pueda deshacer. */
async function bloqueObjetivo(proveedor: Provider): Promise<number> {
  try {
    const final = await proveedor.getBlock("finalized");
    if (final) return final.number;
  } catch {
    // Proveedor sin la etiqueta "finalized": margen fijo.
  }
  return Math.max(0, (await proveedor.getBlockNumber()) - MARGEN_SIN_FINALIZED);
}

async function bloqueInicial(proveedor: Provider, contrato: string, objetivo: number): Promise<number> {
  const valor = process.env.CONTRATO_BLOQUE_DESPLIEGUE;
  const configurado = enteroDeEntorno(valor, 0);
  if (configurado !== null) return configurado;
  // Un valor no válido (p. ej., la dirección del contrato) se ignora y se avisa.
  if (valor) registrarAviso("CONTRATO_BLOQUE_DESPLIEGUE", "no es un numero de bloque decimal; se busca en la cadena");
  return primerBloqueQueCumple(async (numero) => (await proveedor.getCode(contrato, numero)) !== "0x", 0, objetivo);
}

export interface EstadoIndice {
  ultimoBloque: number;
  ultimoTimestamp: number;
}

export async function leerEstadoIndice(contrato: string): Promise<EstadoIndice | null> {
  await asegurarEsquemaEventos();
  const filas = await query<{ ultimo_bloque: string; ultimo_timestamp: string }>(
    "SELECT ultimo_bloque, ultimo_timestamp FROM indice_eventos WHERE contrato = $1",
    [contrato.toLowerCase()]
  );
  return filas[0]
    ? { ultimoBloque: Number(filas[0].ultimo_bloque), ultimoTimestamp: Number(filas[0].ultimo_timestamp) }
    : null;
}

/** Un ciclo: procesa como mucho INDEXADOR_CONSULTAS_POR_CICLO rangos. */
export async function indexarCiclo(): Promise<{ procesadoHasta: number; objetivo: number }> {
  const contrato = contratoLectura();
  const direccion = direccionContrato().toLowerCase();
  const proveedor = contrato.runner as Provider;
  const tamano = entero(process.env.RPC_MAX_BLOQUES_LOGS, 10);
  const maximo = entero(process.env.INDEXADOR_CONSULTAS_POR_CICLO, 100);
  const pausa = entero(process.env.INDEXADOR_PAUSA_MS, 200);

  const objetivo = await bloqueObjetivo(proveedor);
  const estado = await leerEstadoIndice(direccion);
  const ultimo = estado ? estado.ultimoBloque : (await bloqueInicial(proveedor, direccion, objetivo)) - 1;
  const rangos = rangosDelCiclo(ultimo, objetivo, tamano, maximo);
  const filtro = contrato.filters.VotoEmitido();

  let procesadoHasta = ultimo;
  for (const [inicio, fin] of rangos) {
    const registros = (await contrato.queryFilter(filtro, inicio, fin)).filter((r): r is EventLog => "args" in r);

    // Vía del voto: selector de la función de la transacción (solo si va al contrato).
    const selectores = new Map<string, string | null>();
    for (const hash of new Set(registros.map((r) => r.transactionHash))) {
      const tx = await proveedor.getTransaction(hash);
      selectores.set(hash, tx && tx.to?.toLowerCase() === direccion ? tx.data.slice(0, 10) : null);
    }

    await enTransaccion(async (cliente) => {
      for (const r of registros) {
        await cliente.query(
          `INSERT INTO eventos_voto (contrato, tx_hash, indice_log, bloque, propuesta_id, nullifier, opcion, selector)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [
            direccion,
            r.transactionHash,
            r.index,
            r.blockNumber,
            String(r.args.propuestaId).toLowerCase(),
            String(r.args.nullifier).toLowerCase(),
            Number(r.args.opcion),
            selectores.get(r.transactionHash) ?? null,
          ]
        );
      }
      // GREATEST: dos procesos a la vez nunca hacen retroceder el índice.
      await cliente.query(
        `INSERT INTO indice_eventos (contrato, ultimo_bloque) VALUES ($1, $2)
         ON CONFLICT (contrato) DO UPDATE
           SET ultimo_bloque = GREATEST(indice_eventos.ultimo_bloque, EXCLUDED.ultimo_bloque), actualizado_en = now()`,
        [direccion, fin]
      );
    });
    procesadoHasta = fin;
    await esperar(pausa);
  }

  // Timestamp del último bloque procesado: con él se sabe si una propuesta
  // ya cerrada está completa en el índice. Si el proceso se corta antes de
  // llegar aquí, queda un timestamp anterior (más prudente), nunca posterior.
  if (procesadoHasta > ultimo) {
    const bloque = await proveedor.getBlock(procesadoHasta);
    if (bloque) {
      await query(
        `UPDATE indice_eventos SET ultimo_timestamp = GREATEST(ultimo_timestamp, $2)
         WHERE contrato = $1 AND ultimo_bloque >= $3`,
        [direccion, bloque.timestamp, procesadoHasta]
      );
    }
  }
  return { procesadoHasta, objetivo };
}

let iniciado = false;

/** Arranca el ciclo periódico. Se llama una vez desde instrumentation.ts. */
export function iniciarIndexador(): void {
  if (iniciado) return;
  iniciado = true;
  const intervalo = entero(process.env.INDEXADOR_INTERVALO_S, 30) * 1000;

  const ciclo = async () => {
    let espera = intervalo;
    try {
      const { procesadoHasta, objetivo } = await indexarCiclo();
      // Mientras quede atrasado, el siguiente ciclo empieza enseguida.
      if (procesadoHasta < objetivo) espera = 1000;
    } catch (error) {
      registrarError("indexador de eventos", error);
      espera = ESPERA_TRAS_ERROR_MS;
    }
    setTimeout(ciclo, espera).unref();
  };

  registrarAviso("indexador de eventos", "activo");
  setTimeout(ciclo, 1000).unref();
}

/** Activo con base de datos y salvo INDEXADOR_EVENTOS=false. */
export function indexadorHabilitado(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.INDEXADOR_EVENTOS !== "false";
}
