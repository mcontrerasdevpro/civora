import { ZKPassport } from "@zkpassport/sdk";
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
 */

const APP_DOMAIN = process.env.NEXT_PUBLIC_ZKPASSPORT_DOMAIN ?? "demo.zkpassport.id";

export interface SolicitudVerificacion {
  url: string;
  requestId: string;
}

export async function crearSolicitudVerificacion(
  elegibilidad: Eligibility
): Promise<SolicitudVerificacion> {
  const zkPassport = new ZKPassport(APP_DOMAIN);

  const queryBuilder = await zkPassport.request({
    name: "CIVORA",
    logo: "https://civora.example/logo.png",
    purpose: "Verificar que puedes votar sin revelar tu identidad",
    scope: "civora-elegibilidad",
  });

  let query = queryBuilder;

  if (elegibilidad.edadMinima > 0) {
    query = query.gte("age", elegibilidad.edadMinima);
  }
  if (elegibilidad.requiereDniEspanol) {
    // TODO: confirmar en docs.zkpassport.id el codigo de pais exacto
    // (alpha-3 "ESP") antes de pasar a produccion.
    query = query.eq("nationality", "ESP");
  }

  const { url, requestId } = query.done();

  return { url, requestId };
}

export interface ResultadoVerificacionServidor {
  valido: boolean;
  identificadorUnico: string | null;
  errores?: unknown;
}

export async function verificarPruebaServidor(params: {
  proofs: unknown;
  query: unknown;
  queryResult: unknown;
}): Promise<ResultadoVerificacionServidor> {
  const zkPassport = new ZKPassport(APP_DOMAIN);

  // TODO: sustituir `any` por los tipos reales exportados por @zkpassport/sdk
  // (Proofs, QueryResult, Query) en cuanto se confirmen en la documentacion.
  const { verified, queryResultErrors, uniqueIdentifier } = await zkPassport.verify({
    proofs: params.proofs,
    originalQuery: params.query,
    queryResult: params.queryResult,
  } as any);

  return {
    valido: verified,
    identificadorUnico: uniqueIdentifier ?? null,
    errores: queryResultErrors,
  };
}
