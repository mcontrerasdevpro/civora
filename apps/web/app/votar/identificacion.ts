import type { SolidityVerifierParameters } from "@civora/zk-identity";

/**
 * Resultado del paso de identificación. La vía ZK no lleva nullifier: lo
 * calcula el propio contrato al votar, a partir de la prueba ya verificada
 * on-chain (ver VotacionAnonima.votarConPruebaZk).
 */
export type Identificacion =
  | { tipo: "manual"; nullifier: string }
  | { tipo: "zk"; parametrosVerificacion: SolidityVerifierParameters };
