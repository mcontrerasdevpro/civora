import type { SolidityVerifierParameters } from "@civora/zk-identity";

/**
 * Resultado del paso de identificación. La vía ZK no lleva nullifier: lo
 * calcula el propio contrato al votar, a partir de la prueba ya verificada
 * on-chain (ver VotacionAnonima.votarConPruebaZk). La vía de certificado
 * tampoco lo calcula en el navegador: lo deriva el servidor tras verificar
 * la firma (ver lib/certificado-digital.ts), tal como corresponde a una
 * verificación fuera de cadena.
 */
export type Identificacion =
  | { tipo: "manual"; nullifier: string }
  | { tipo: "zk"; parametrosVerificacion: SolidityVerifierParameters }
  | {
      tipo: "certificado";
      propuestaId: string;
      timestamp: number;
      reto: string;
      signatureB64: string;
      certB64: string;
    };
