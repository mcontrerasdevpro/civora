/**
 * Deriva un nullifier a partir del documento y la propuesta, en el navegador,
 * para que el "documento" nunca salga del cliente.
 *
 * Sustituye temporalmente a packages/zk-identity (integracion real con
 * ZKPassport pendiente, ver README). El mismo documento produce siempre el
 * mismo nullifier para una propuesta dada, que es la propiedad que impide
 * el doble voto sin identificar al votante.
 */
export async function derivarNullifierDemo(
  propuestaId: string,
  documento: string
): Promise<string> {
  const datos = new TextEncoder().encode(`${propuestaId}:${documento.trim().toUpperCase()}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
