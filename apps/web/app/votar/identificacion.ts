import type { SolidityVerifierParameters } from "@civora/zk-identity";

/**
 * Resultado del paso de identificación. La vía ZK no lleva nullifier: lo
 * calcula el propio contrato al votar, a partir de la prueba ya verificada
 * on-chain (ver VotacionAnonima.votarConPruebaZk). La vía de certificado
 * solo queda preparada: la firma se hace al confirmar el voto, porque el
 * reto firmado incluye la opción (R-04), y el servidor deriva el nullifier
 * tras verificarla (ver lib/certificado-digital.ts).
 */
export type Identificacion =
  | { tipo: "zk"; parametrosVerificacion: SolidityVerifierParameters }
  | { tipo: "certificado" };
