import { NextResponse } from "next/server";
import { buscarPropuesta } from "../../../../lib/propuestas-store";
import { MENSAJE_PROPUESTA_ARCHIVADA } from "../../../../lib/errores-contrato.mjs";
import { leerResultados } from "../../../../lib/contrato";
import { resultadosVisibles } from "../../../../lib/resultados-visibles.mjs";
import { segmentoFinal } from "../../../../lib/parametros-ruta.mjs";
import { registrarError } from "../../../../lib/registro.mjs";
import { viasDePropuesta, viasHabilitadas } from "../../../../lib/vias-voto.mjs";

// Sin esto, Next.js horneraria el resultado on-chain como contenido
// estatico en el build y nunca volveria a consultar el contrato.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = segmentoFinal(request);
  const encontrada = await buscarPropuesta(id);
  if (!encontrada) {
    return NextResponse.json({ error: "Propuesta inexistente." }, { status: 404 });
  }
  if (encontrada.archivada) {
    return NextResponse.json({ error: MENSAJE_PROPUESTA_ARCHIVADA, archivada: true }, { status: 410 });
  }
  const { propuesta } = encontrada;
  // Vía con la que se admite votar (A-04): la fijada en el contrato, si sigue
  // habilitada. La página de voto solo ofrece estas.
  const viasPermitidas = viasDePropuesta(encontrada.via, viasHabilitadas(process.env.VIAS_HABILITADAS));

  if (!resultadosVisibles(propuesta.fechaCierre)) {
    return NextResponse.json({ propuesta, viasPermitidas, resultados: null });
  }

  try {
    return NextResponse.json({ propuesta, viasPermitidas, resultados: await leerResultados(id) });
  } catch (error) {
    // Pasa, por ejemplo, con propuestas creadas con un contrato anterior.
    registrarError("resultados no disponibles", error);
    return NextResponse.json({ propuesta, viasPermitidas, resultados: null, resultadosNoDisponibles: true });
  }
}
