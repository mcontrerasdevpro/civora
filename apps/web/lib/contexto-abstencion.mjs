import { id as ethersId } from "ethers";

export const TEXTO_DECLARACION_ABSTENCION = "Manifiesto que no ejerceré mi voto en esta votación.";

/** Liga la firma al texto fijo y a la instantánea concreta de la propuesta. */
export function contextoFirmaAbstencion(propuesta) {
  return `abstencion:${ethersId(JSON.stringify({
    schema: "civora/abstencion/v1",
    propuestaId: propuesta.id,
    titulo: propuesta.titulo,
    pregunta: propuesta.pregunta,
    fechaApertura: propuesta.fechaApertura,
    fechaCierre: propuesta.fechaCierre,
    declaracion: TEXTO_DECLARACION_ABSTENCION,
  }))}`;
}
