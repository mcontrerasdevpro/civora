import { NextResponse } from "next/server";
import { obtenerPropuesta } from "../../../../lib/propuestas-store";
import { leerResultados } from "../../../../lib/contrato";
import { resultadosVisibles } from "../../../../lib/resultados-visibles.mjs";
import { segmentoFinal } from "../../../../lib/parametros-ruta.mjs";

// Sin esto, Next.js horneraria el resultado on-chain como contenido
// estatico en el build y nunca volveria a consultar el contrato.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = segmentoFinal(request);
  const propuesta = await obtenerPropuesta(id);
  if (!propuesta) {
    return NextResponse.json({ error: "Propuesta inexistente." }, { status: 404 });
  }

  if (!resultadosVisibles(propuesta.fechaCierre)) {
    return NextResponse.json({ propuesta, resultados: null });
  }

  return NextResponse.json({ propuesta, resultados: await leerResultados(id) });
}
