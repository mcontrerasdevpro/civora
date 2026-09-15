import type { Eligibility } from "@voto-anonimo/shared-types";

/**
 * Capa de abstracción sobre el proveedor de identidad ZK.
 *
 * Ningún otro paquete de este monorepo debe importar el SDK de ZKPassport
 * (ni ningún otro proveedor) directamente. Todo pasa por aquí, para poder
 * sustituir el proveedor en el futuro (p.ej. por la Cartera Europea de
 * Identidad Digital / eIDAS 2.0) tocando solo este paquete.
 *
 * NOTA: esto es un esqueleto de PoC. La integración real con
 * @zkpassport/sdk (escaneo NFC/MRZ, generación de la prueba, verificación
 * on-chain) queda pendiente de implementar.
 */

export interface ResultadoVerificacionIdentidad {
  /** true si la prueba es válida y cumple los requisitos de elegibilidad. */
  valido: boolean;
  /** Identificador único no vinculable a la identidad real, para evitar doble voto. */
  nullifier: string;
  /** La prueba ZK en sí, para adjuntar al voto. */
  pruebaZk: string;
}

/**
 * Solicita al votante que escanee su documento (DNIe/pasaporte) y genere una
 * prueba ZK de que cumple los requisitos de elegibilidad, sin revelar sus
 * datos personales.
 */
export async function verificarIdentidad(
  _elegibilidad: Eligibility
): Promise<ResultadoVerificacionIdentidad> {
  throw new Error(
    "TODO: integrar @zkpassport/sdk aqui. Ver docs.zkpassport.id para el flujo de escaneo NFC/MRZ y generacion de prueba."
  );
}

/** Verifica, del lado del servidor/contrato, que una prueba ZK es válida. */
export async function verificarPrueba(_pruebaZk: string): Promise<boolean> {
  throw new Error("TODO: verificacion server-side de la prueba ZK.");
}
