import { atenderServidorIntermedio } from "../../../lib/servidor-intermedio-store";

/**
 * RetrieveService del servidor intermedio de Autofirma para móviles (ADR 0024). La ruta
 * es la que autoscript.js usa por defecto en el mismo origen.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return atenderServidorIntermedio(request, "recuperacion");
}

export function POST(request: Request) {
  return atenderServidorIntermedio(request, "recuperacion");
}
