import { NextResponse } from "next/server";
import { PROPUESTA_DEMO } from "../../../lib/propuesta-demo";
import { leerResultados } from "../../../lib/contrato";

// Sin esto, Next.js horneraria el resultado on-chain como contenido
// estatico en el build y nunca volveria a consultar el contrato.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    propuesta: PROPUESTA_DEMO,
    resultados: await leerResultados(),
  });
}
