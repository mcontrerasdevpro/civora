import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRateLimit } from "../../../lib/admin-auth.mjs";
import { registrarError } from "../../../lib/registro.mjs";
import { crearPropuesta, listarPropuestas } from "../../../lib/propuestas-store";
import { viaParaNuevaPropuesta, viasHabilitadas } from "../../../lib/vias-voto.mjs";

export const dynamic = "force-dynamic";

const CuerpoCreacionSchema = z.object({
  titulo: z.string().trim().min(1, "El titulo es obligatorio."),
  pregunta: z.string().trim().min(1, "La pregunta es obligatoria."),
  descripcion: z.string().trim().default(""),
  fechaApertura: z.string().datetime({ message: "Fecha de apertura invalida." }),
  duracionDias: z.number().int().positive().max(365),
  // Única vía con la que se podrá votar, fijada en el contrato (ADR 0021).
  // Sin ella, la primera de VIAS_HABILITADAS.
  via: z.enum(["certificado", "zk"]).optional(),
});

export async function GET() {
  // Vías con las que se puede crear una propuesta (el formulario solo ofrece estas).
  return NextResponse.json({
    propuestas: await listarPropuestas(),
    viasHabilitadas: viasHabilitadas(process.env.VIAS_HABILITADAS),
  });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const rateLimit = checkAdminRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  // Creación abierta en la demo (riesgo aceptado M-04): solo la limita el tope por IP.
  const cuerpo = await request.json().catch(() => null);
  const parseo = CuerpoCreacionSchema.safeParse(cuerpo);

  if (!parseo.success) {
    return NextResponse.json(
      { error: "Datos de la propuesta invalidos.", detalles: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const { titulo, pregunta, descripcion, fechaApertura, duracionDias } = parseo.data;
  const via = viaParaNuevaPropuesta(parseo.data.via, viasHabilitadas(process.env.VIAS_HABILITADAS));
  if (!via) {
    return NextResponse.json({ error: "Esa forma de identificarse no está habilitada." }, { status: 400 });
  }
  const apertura = new Date(fechaApertura);
  const cierre = new Date(apertura.getTime() + duracionDias * 24 * 60 * 60 * 1000);

  try {
    const propuesta = await crearPropuesta({
      titulo,
      pregunta,
      descripcion,
      fechaApertura: apertura.toISOString(),
      fechaCierre: cierre.toISOString(),
      via,
    });
    return NextResponse.json({ propuesta }, { status: 201 });
  } catch (error) {
    // El mensaje de ethers incluye la transacción y datos del proveedor RPC:
    // ni se devuelve ni se registra entero.
    registrarError("propuesta no creada", error);
    return NextResponse.json({ error: "No se ha podido crear la propuesta." }, { status: 500 });
  }
}
