import { ZKPassport, type ProofResult, type Query, type QueryBuilderResult, type QueryResult } from "@zkpassport/sdk";
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
 * crearSolicitudVerificacion() abre una conexion (WebSocket) con la app
 * movil de ZKPassport que debe permanecer viva mientras se espera la
 * respuesta: solo puede llamarse desde el navegador (componente cliente),
 * nunca desde una ruta de servidor serverless, o los callbacks nunca
 * llegarian. verificarPruebaServidor() sí corre en el servidor: repite la
 * verificacion de las pruebas recibidas del cliente para no confiar en el
 * "verified" que el propio navegador podria falsear.
 */

const APP_DOMAIN = process.env.NEXT_PUBLIC_ZKPASSPORT_DOMAIN ?? "demo.zkpassport.id";

// demo.zkpassport.id solo acepta pruebas de prueba (mock). Al desplegar con
// un dominio propio real, fijar NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false.
const DEV_MODE = process.env.NEXT_PUBLIC_ZKPASSPORT_DEV_MODE !== "false";

function scopeDePropuesta(propuestaId: string): string {
  return `civora-voto-${propuestaId}`;
}

export type SolicitudVerificacionZk = QueryBuilderResult;

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
  });

  let query = queryBuilder;

  if (elegibilidad.edadMinima > 0) {
    query = query.gte("age", elegibilidad.edadMinima);
  }
  if (elegibilidad.requiereDniEspanol) {
    query = query.eq("nationality", "ESP");
  }

  return query.done();
}

export interface ResultadoVerificacionServidor {
  valido: boolean;
  identificadorUnico: string | null;
  errores?: unknown;
}

export async function verificarPruebaServidor(params: {
  proofs: ProofResult[];
  query: Query;
  queryResult: QueryResult;
  propuestaId: string;
}): Promise<ResultadoVerificacionServidor> {
  const zkPassport = new ZKPassport(APP_DOMAIN);

  const { verified, queryResultErrors, uniqueIdentifier } = await zkPassport.verify({
    proofs: params.proofs,
    originalQuery: params.query,
    queryResult: params.queryResult,
    scope: scopeDePropuesta(params.propuestaId),
    devMode: DEV_MODE,
    // Vercel solo permite escribir en /tmp; en local, dejar que el SDK use
    // su directorio por defecto.
    writingDirectory: process.env.VERCEL ? "/tmp" : undefined,
  });

  return {
    valido: verified,
    identificadorUnico: uniqueIdentifier ?? null,
    errores: queryResultErrors,
  };
}

/**
 * Deriva el nullifier final a partir del identificador unico que entrega
 * ZKPassport tras verificar la prueba. Nunca se expone `identificadorUnico`
 * fuera de esta funcion: lo unico que sale al cliente y al contrato es este
 * hash.
 */
export async function derivarNullifierZk(propuestaId: string, identificadorUnico: string): Promise<string> {
  const datos = new TextEncoder().encode(`${propuestaId}:${identificadorUnico}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
