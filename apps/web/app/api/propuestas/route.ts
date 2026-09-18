import { NextResponse } from "next/server";
import { z } from "zod";
import { crearPropuesta, listarPropuestas } from "../../../lib/propuestas-store";

export const dynamic = "force-dynamic";

const CuerpoCreacionSchema = z.object({
  titulo: z.string().trim().min(1, "El titulo es obligatorio."),
  pregunta: z.string().trim().min(1, "La pregunta es obligatoria."),
  descripcion: z.string().trim().default(""),
  fechaApertura: z.string().datetime({ message: "Fecha de apertura invalida." }),
  duracionDias: z.number().int().positive().max(365),
});

export async function GET() {
  return NextResponse.json({ propuestas: await listarPropuestas() });
}

// TODO: sin control de acceso de momento (ver historial de este archivo):
// cualquiera puede crear una propuesta on-chain. Restaurar la comprobacion
// de ADMIN_SECRET (o un flujo de aprobacion) antes de un uso real.
export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const parseo = CuerpoCreacionSchema.safeParse(cuerpo);

  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos de la propuesta invalidos.", detalles: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const { titulo, pregunta, descripcion, fechaApertura, duracionDias } = parseo.data;
  const apertura = new Date(fechaApertura);
  const cierre = new Date(apertura.getTime() + duracionDias * 24 * 60 * 60 * 1000);

  try {
    const propuesta = await crearPropuesta({
      titulo,
      pregunta,
      descripcion,
      fechaApertura: apertura.toISOString(),
      fechaCierre: cierre.toISOString(),
    });
    return NextResponse.json({ propuesta }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "No se ha podido crear la propuesta." },
      { status: 500 }
    );
  }
}
