import { randomUUID } from "crypto";
import { id as ethersId } from "ethers";
import { EligibilitySchema, type Eligibility, type OpcionVoto, type Propuesta } from "@civora/shared-types";
import { asegurarEsquema, query } from "./db";
import { crearPropuestaOnChain } from "./contrato";

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

export async function listarPropuestas(): Promise<Propuesta[]> {
  await asegurarEsquema();
  const filas = await query<FilaPropuesta>(
    "SELECT * FROM propuestas ORDER BY creado_en DESC"
  );
  return filas.map(filaAPropuesta);
}

export async function obtenerPropuesta(id: string): Promise<Propuesta | null> {
  await asegurarEsquema();
  const filas = await query<FilaPropuesta>("SELECT * FROM propuestas WHERE id = $1", [id]);
  return filas[0] ? filaAPropuesta(filas[0]) : null;
}

export async function crearPropuesta(datos: {
  titulo: string;
  pregunta: string;
  descripcion: string;
  fechaApertura: string;
  fechaCierre: string;
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
  });

  await query(
    `INSERT INTO propuestas
      (id, titulo, descripcion, pregunta, opciones, fecha_apertura, fecha_cierre, elegibilidad, contenido_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
    ]
  );

  return { ...contenido, contenidoHash };
}
