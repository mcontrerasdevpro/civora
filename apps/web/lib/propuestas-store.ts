import { randomUUID } from "crypto";
import { id as ethersId } from "ethers";
import { EligibilitySchema, type Eligibility, type OpcionVoto, type Propuesta } from "@civora/shared-types";
import { asegurarEsquema, query } from "./db";
import { crearPropuestaOnChain, direccionContrato } from "./contrato";
import { esPropuestaVigente } from "./errores-contrato.mjs";
import { viasDePropuesta, viasHabilitadas, type ViaVoto } from "./vias-voto.mjs";

/** Requisitos fijos de esta PoC (ver README): no se exponen en el formulario todavia. */
const ELEGIBILIDAD_POR_DEFECTO: Eligibility = EligibilitySchema.parse({});
const OPCIONES_FIJAS: OpcionVoto[] = ["a_favor", "en_contra", "abstencion"];

interface FilaPropuesta {
  id: string;
  titulo: string;
  descripcion: string;
  pregunta: string;
  opciones: OpcionVoto[];
  fecha_apertura: Date;
  fecha_cierre: Date;
  elegibilidad: Eligibility;
  contenido_hash: string;
  contrato: string | null;
  via: ViaVoto | null;
}

function filaAPropuesta(fila: FilaPropuesta): Propuesta {
  return {
    schema: "propuesta/v1",
    id: fila.id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    pregunta: fila.pregunta,
    opciones: fila.opciones,
    fechaApertura: fila.fecha_apertura.toISOString(),
    fechaCierre: fila.fecha_cierre.toISOString(),
    elegibilidad: fila.elegibilidad,
    contenidoHash: fila.contenido_hash,
  };
}

/** Propuestas del contrato actual; las de contratos anteriores no se listan. */
export async function listarPropuestas(): Promise<Propuesta[]> {
  await asegurarEsquema();
  const filas = await query<FilaPropuesta>(
    "SELECT * FROM propuestas ORDER BY creado_en DESC"
  );
  const actual = direccionContrato();
  return filas.filter((fila) => esPropuestaVigente(fila.contrato, actual)).map(filaAPropuesta);
}

/**
 * Busca una propuesta e indica si es de un contrato anterior (archivada):
 * existe, pero el contrato actual no la conoce y no admite votos.
 */
export async function buscarPropuesta(
  id: string
): Promise<{ propuesta: Propuesta; archivada: boolean; via: ViaVoto | null } | null> {
  await asegurarEsquema();
  const filas = await query<FilaPropuesta>("SELECT * FROM propuestas WHERE id = $1", [id]);
  if (!filas[0]) return null;
  return {
    propuesta: filaAPropuesta(filas[0]),
    archivada: !esPropuestaVigente(filas[0].contrato, direccionContrato()),
    via: filas[0].via,
  };
}

/** Propuesta del contrato actual, o null si no existe o es de un contrato anterior. */
export async function obtenerPropuesta(id: string): Promise<Propuesta | null> {
  const encontrada = await buscarPropuesta(id);
  return encontrada && !encontrada.archivada ? encontrada.propuesta : null;
}

export async function crearPropuesta(datos: {
  titulo: string;
  pregunta: string;
  descripcion: string;
  fechaApertura: string;
  fechaCierre: string;
  via: ViaVoto;
}): Promise<Propuesta> {
  await asegurarEsquema();

  const id = randomUUID();
  const contenido: Omit<Propuesta, "contenidoHash"> = {
    schema: "propuesta/v1",
    id,
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    pregunta: datos.pregunta,
    opciones: OPCIONES_FIJAS,
    fechaApertura: datos.fechaApertura,
    fechaCierre: datos.fechaCierre,
    elegibilidad: ELEGIBILIDAD_POR_DEFECTO,
  };
  const contenidoHash = ethersId(JSON.stringify(contenido));

  // Se crea primero on-chain: si falla (red, gas...), no queda huerfana en
  // la base de datos. El hash queda anclado en el contrato como ancla de
  // integridad del contenido guardado aqui.
  await crearPropuestaOnChain({
    propuestaId: id,
    contenidoHash,
    fechaApertura: datos.fechaApertura,
    fechaCierre: datos.fechaCierre,
    via: datos.via,
  });

  await query(
    `INSERT INTO propuestas
      (id, titulo, descripcion, pregunta, opciones, fecha_apertura, fecha_cierre, elegibilidad, contenido_hash, contrato, via)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      datos.titulo,
      datos.descripcion,
      datos.pregunta,
      OPCIONES_FIJAS,
      datos.fechaApertura,
      datos.fechaCierre,
      JSON.stringify(ELEGIBILIDAD_POR_DEFECTO),
      contenidoHash,
      direccionContrato(),
      datos.via,
    ]
  );

  return { ...contenido, contenidoHash };
}

/**
 * Vías con las que se puede votar en una propuesta vigente: la fijada en el
 * contrato, si sigue habilitada (ADR 0021).
 */
export async function viasPermitidasDe(id: string): Promise<ViaVoto[]> {
  const encontrada = await buscarPropuesta(id);
  return viasDePropuesta(encontrada?.via, viasHabilitadas(process.env.VIAS_HABILITADAS));
}
