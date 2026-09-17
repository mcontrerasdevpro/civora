import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerPropuesta } from "../../../../../lib/propuestas-store";
import { generarReto } from "../../../../../lib/certificado-digital";

const CuerpoSchema = z.object({ propuestaId: z.string().uuid() });

export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const parseo = CuerpoSchema.safeParse(cuerpo);
  if (!parseo.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!(await obtenerPropuesta(parseo.data.propuestaId))) {
    return NextResponse.json({ error: "Propuesta inexistente." }, { status: 404 });
  }

  const { reto, timestamp } = generarReto(parseo.data.propuestaId);
  return NextResponse.json({ reto, timestamp });
}
