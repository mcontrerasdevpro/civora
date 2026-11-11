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

/**
 * Comprueba si se admite una abstención notificada en este momento. Devuelve
 * `null` si se admite o el motivo del rechazo: la propuesta debe estar en su
 * periodo de votación y admitir la vía de certificado, la única con la que
 * el registro bloquea un voto posterior en Civora.
 */
export function motivoRechazoAbstencion(propuesta, viasPermitidas, ahora = Date.now()) {
  if (ahora < Date.parse(propuesta.fechaApertura)) return "no-abierta";
  if (ahora >= Date.parse(propuesta.fechaCierre)) return "cerrada";
  if (!viasPermitidas.includes("certificado")) return "via-no-permitida";
  return null;
}
