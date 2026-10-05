import { NextResponse } from "next/server";
import { obtenerPropuesta } from "../../../../lib/propuestas-store";
import { leerResultados } from "../../../../lib/contrato";
import { resultadosVisibles } from "../../../../lib/resultados-visibles.mjs";

// Sin esto, Next.js horneraria el resultado on-chain como contenido
// estatico en el build y nunca volveria a consultar el contrato.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const propuesta = await obtenerPropuesta(params.id);
  if (!propuesta) {
    return NextResponse.json({ error: "Propuesta inexistente." }, { status: 404 });
  }

  if (!resultadosVisibles(propuesta.fechaCierre)) {
    return NextResponse.json({ propuesta, resultados: null });
  }

  return NextResponse.json({ propuesta, resultados: await leerResultados(params.id) });
}
