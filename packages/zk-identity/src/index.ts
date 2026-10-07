import { ZKPassport, type ProofResult, type QueryBuilderResult, type SolidityVerifierParameters } from "@zkpassport/sdk";
import type { Eligibility } from "@civora/shared-types";

/**
 * Capa de abstraccion sobre el proveedor de identidad ZK.
 *
 * Ningun otro paquete de este monorepo debe importar @zkpassport/sdk
 * directamente. Todo pasa por aqui, para poder sustituir el proveedor en el
 * futuro (p.ej. por la Cartera Europea de Identidad Digital / eIDAS 2.0)
 * tocando solo este paquete.
 *
 * LIMITACION IMPORTANTE (ver docs/modelo-amenazas.md): el chip NFC del
 * DNIe/pasaporte no contiene datos de empadronamiento ni de anios de
 * residencia - solo nacionalidad, edad, nombre y algunos campos mas. Esta
 * capa prueba nacionalidad espaniola y mayoria de edad sin revelarlas. El
 * empadronamiento y los 5 anios de residencia siguen requiriendo un oraculo
 * externo (convenio con el INE / Padron), pendiente de implementar.
 *
 * La prueba se verifica dentro del propio contrato VotacionAnonima
 * (votarConPruebaZk, contra el RootVerifier oficial de ZKPassport), no en
 * este servidor: ni el operador de este sistema puede aceptar un voto sin
 * una prueba criptografica valida. Por eso la solicitud se genera en modo
 * "compressed-evm" (unico modo verificable en una cadena EVM) y esta capa
 * solo prepara los parametros que el contrato espera, sin verificar nada
 * ella misma.
 *
 * crearSolicitudVerificacion() abre una conexion (WebSocket) con la app
 * movil de ZKPassport que debe permanecer viva mientras se espera la
 * respuesta: solo puede llamarse desde el navegador (componente cliente),
 * nunca desde una ruta de servidor serverless, o los callbacks nunca
 * llegarian.
 */

const APP_DOMAIN = process.env.NEXT_PUBLIC_ZKPASSPORT_DOMAIN ?? "demo.zkpassport.id";

// El modo demo solo se activa con opt-in explícito y debe coincidir con el contrato.
const DEV_MODE = process.env.NEXT_PUBLIC_ZKPASSPORT_DEV_MODE === "true";

/** Debe coincidir exactamente con el ambito que reconstruye VotacionAnonima.votarConPruebaZk. */
function scopeDePropuesta(propuestaId: string): string {
  return `civora-voto-${propuestaId}`;
}

export type SolicitudVerificacionZk = QueryBuilderResult;
export type { SolidityVerifierParameters };

export async function crearSolicitudVerificacion(params: {
  elegibilidad: Eligibility;
  propuestaId: string;
}): Promise<SolicitudVerificacionZk> {
  const { elegibilidad, propuestaId } = params;
  const zkPassport = new ZKPassport(APP_DOMAIN);

  const queryBuilder = await zkPassport.request({
    name: "CÍVORA",
    logo: "https://civora.example/logo.png",
    purpose: "Verificar que puedes votar sin revelar tu identidad",
    // El scope ata el identificador unico a esta propuesta concreta: la
    // misma persona genera un nullifier distinto en cada propuesta, y no es
    // posible correlacionar sus votos entre propuestas.
    scope: scopeDePropuesta(propuestaId),
    devMode: DEV_MODE,
    // Unico modo que genera una prueba ("outer_evm") verificable en una
    // cadena EVM; ver obtenerParametrosVerificacionOnChain.
    mode: "compressed-evm",
  });

  let query = queryBuilder;

  if (elegibilidad.edadMinima > 0) {
    query = query.gte("age", elegibilidad.edadMinima);
  }
  if (elegibilidad.requiereDniEspanol) {
    // .in() (no .eq()) es la que empareja con el helper on-chain
    // isNationalityIn que usa VotacionAnonima.votarConPruebaZk.
    query = query.in("nationality", ["ESP"]);
  }

  return query.done();
}

/**
 * A partir de las pruebas que entrega el callback `onResult` de la
 * solicitud, prepara los parametros que espera
 * VotacionAnonima.votarConPruebaZk (mismo formato que devuelve
 * `getSolidityVerifierParameters` del SDK). No verifica nada: la
 * verificacion real la hace el contrato al votar.
 */
export function obtenerParametrosVerificacionOnChain(params: {
  proofs: ProofResult[];
  propuestaId: string;
}): SolidityVerifierParameters {
  const zkPassport = new ZKPassport(APP_DOMAIN);

  const proof = params.proofs.find((p) => p.name?.startsWith("outer_evm"));
  if (!proof) {
    throw new Error(
      "La prueba generada no es verificable en una cadena EVM (falta el proof 'outer_evm')."
    );
  }

  return zkPassport.getSolidityVerifierParameters({
    proof,
    domain: APP_DOMAIN,
    scope: scopeDePropuesta(params.propuestaId),
    devMode: DEV_MODE,
  });
}
