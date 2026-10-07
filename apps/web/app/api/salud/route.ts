import { NextResponse } from "next/server";

/**
 * Healthcheck para Easypanel y el HEALTHCHECK de la imagen Docker. Solo
 * indica que el proceso responde: no consulta la base de datos ni la cadena
 * y no devuelve versión, commit ni configuración.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ estado: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
