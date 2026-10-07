/**
 * Resultado del paso de identificación: solo deja preparada la vía elegida.
 * En las dos la prueba de identidad se hace al confirmar el voto, porque
 * incluye la opción:
 * - ZK: la prueba ZKPassport lleva la opción como dato vinculado (R-01) y el
 *   contrato la verifica y calcula el nullifier al votar (ver
 *   VotacionAnonima.votarConPruebaZk).
 * - Certificado: el reto firmado incluye la opción (R-04) y el servidor
 *   deriva el nullifier tras verificar la firma (ver lib/certificado-digital.ts).
 */
export type Identificacion = { tipo: "zk" } | { tipo: "certificado" };
