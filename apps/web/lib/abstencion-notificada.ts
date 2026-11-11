import { randomUUID } from "node:crypto";
import { id as ethersId } from "ethers";
import { enTransaccion, query, asegurarEsquemaAbstenciones } from "./db";
import { derivarNullifierCertificado, secretoNullifierCertificado } from "./nullifier-certificado.mjs";
import { TEXTO_DECLARACION_ABSTENCION } from "./texto-abstencion.mjs";
import { nullifierABytes32, propuestaIdBytes32, contratoLectura } from "./contrato";

export type DeclaracionAbstencion = {
  propuestaId: string;
  titulo: string;
  pregunta: string;
  fechaApertura: string;
  fechaCierre: string;
  fechaDeclaracion: string;
};

export type ReciboAbstencion = {
  id: string;
  fechaDeclaracion: string;
  huella: string;
  /** Texto firmado, tal como se registró (cambia entre versiones). */
  texto: string;
  declaracion: Omit<DeclaracionAbstencion, "propuestaId">;
};

/** Serializa el registro de abstención y el voto certificado para la misma persona y propuesta. */
export async function conIdentidadBloqueada<T>(
  propuestaId: string,
  nullifier: string,
  accion: (cliente: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  await asegurarEsquemaAbstenciones();
  return enTransaccion(async (cliente) => {
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [propuestaId, nullifier]);
    return accion(cliente);
  });
}

export async function existeAbstencionNotificada(
  cliente: import("pg").PoolClient,
  propuestaId: string,
  nullifier: string
): Promise<boolean> {
  const resultado = await cliente.query(
    "SELECT 1 FROM abstenciones_notificadas WHERE propuesta_id = $1 AND nullifier = $2",
    [propuestaId, nullifier]
  );
  return (resultado.rowCount ?? 0) > 0;
}

/** Guarda solo un pseudónimo HMAC y metadatos públicos; nunca NIF, certificado o firma. */
export async function registrarAbstencionNotificada(
  identificador: string,
  declaracion: DeclaracionAbstencion
): Promise<ReciboAbstencion> {
  const nullifier = derivarNullifierCertificado(
    declaracion.propuestaId,
    identificador,
    secretoNullifierCertificado(process.env)
  );
  const nullifierBytes32 = nullifierABytes32(nullifier);

  return conIdentidadBloqueada(declaracion.propuestaId, nullifier, async (cliente) => {
    if (await existeAbstencionNotificada(cliente, declaracion.propuestaId, nullifier)) {
      throw new Error("ABSTENCION_YA_REGISTRADA");
    }
    const yaVoto: boolean = await contratoLectura().nullifierUsado(
      propuestaIdBytes32(declaracion.propuestaId),
      nullifierBytes32
    );
    if (yaVoto) throw new Error("VOTO_PREVIO");

    const id = randomUUID();
    const fechaDeclaracion = declaracion.fechaDeclaracion;
    const huella = ethersId(JSON.stringify({
      schema: "civora/abstencion-notificada/v2",
      id,
      propuestaId: declaracion.propuestaId,
      titulo: declaracion.titulo,
      pregunta: declaracion.pregunta,
      fechaApertura: declaracion.fechaApertura,
      fechaCierre: declaracion.fechaCierre,
      fechaDeclaracion,
      declaracion: TEXTO_DECLARACION_ABSTENCION,
    }));
    await cliente.query(
      `INSERT INTO abstenciones_notificadas
        (id, propuesta_id, nullifier, fecha_declaracion, titulo, pregunta, fecha_apertura, fecha_cierre, huella, texto_declaracion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, declaracion.propuestaId, nullifier, fechaDeclaracion, declaracion.titulo,
        declaracion.pregunta, declaracion.fechaApertura, declaracion.fechaCierre, huella, TEXTO_DECLARACION_ABSTENCION]
    );
    return {
      id,
      fechaDeclaracion,
      huella,
      texto: TEXTO_DECLARACION_ABSTENCION,
      declaracion: {
        titulo: declaracion.titulo,
        pregunta: declaracion.pregunta,
        fechaApertura: declaracion.fechaApertura,
        fechaCierre: declaracion.fechaCierre,
        fechaDeclaracion,
      },
    };
  });
}

export async function leerReciboAbstencion(id: string): Promise<ReciboAbstencion | null> {
  await asegurarEsquemaAbstenciones();
  const filas = await query<{
    id: string; fecha_declaracion: Date; huella: string; titulo: string; pregunta: string;
    fecha_apertura: Date; fecha_cierre: Date; texto_declaracion: string;
  }>(
    `SELECT id, fecha_declaracion, huella, titulo, pregunta, fecha_apertura, fecha_cierre, texto_declaracion
     FROM abstenciones_notificadas WHERE id = $1`,
    [id]
  );
  const fila = filas[0];
  return fila ? {
    id: fila.id,
    fechaDeclaracion: fila.fecha_declaracion.toISOString(),
    huella: fila.huella,
    texto: fila.texto_declaracion,
    declaracion: {
      titulo: fila.titulo,
      pregunta: fila.pregunta,
      fechaApertura: fila.fecha_apertura.toISOString(),
      fechaCierre: fila.fecha_cierre.toISOString(),
      fechaDeclaracion: fila.fecha_declaracion.toISOString(),
    },
  } : null;
}
