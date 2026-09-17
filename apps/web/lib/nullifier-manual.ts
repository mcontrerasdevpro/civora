/**
 * Deriva un nullifier a partir del DNI y la propuesta, en el navegador, para
 * que el documento nunca salga del cliente.
 *
 * Via de respaldo cuando no se dispone de DNIe/lector NFC (ver
 * packages/zk-identity para la via real con ZKPassport). El DNI aqui solo se
 * valida por formato (ver lib/validacion-dni.ts), no contra ningun registro
 * oficial. El mismo documento produce siempre el mismo nullifier para una
 * propuesta dada, que es la propiedad que impide el doble voto.
 */
export async function derivarNullifierManual(
  propuestaId: string,
  documento: string
): Promise<string> {
  const datos = new TextEncoder().encode(`${propuestaId}:${documento.trim().toUpperCase()}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
