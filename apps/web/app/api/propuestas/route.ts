import { timingSafeEqual } from "crypto";
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

/**
 * El contrato no puede distinguir usuarios de la web: todas las
 * transacciones las firma la misma cuenta "relayer" del servidor (ver
 * lib/contrato.ts). El control de acceso a crear propuestas vive aqui, a
 * nivel de aplicacion, no en el contrato.
 */
function autorizado(request: Request): boolean {
  const clave = request.headers.get("x-admin-key");
  const esperada = process.env.ADMIN_SECRET;
  if (!clave || !esperada) return false;
  const a = Buffer.from(clave);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET() {
  return NextResponse.json({ propuestas: await listarPropuestas() });
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Clave de administrador incorrecta." }, { status: 401 });
  }

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
