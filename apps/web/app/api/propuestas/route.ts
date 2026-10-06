import { NextResponse } from "next/server";
import { z } from "zod";
import { adminSecretMatches, checkAdminRateLimit } from "../../../lib/admin-auth.mjs";
import { registrarError } from "../../../lib/registro.mjs";
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

export async function POST(request: Request) {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const rateLimit = checkAdminRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "La creación de propuestas no está configurada." }, { status: 503 });
  }
  const autorizacion = request.headers.get("authorization");
  const clave = autorizacion?.startsWith("Bearer ") ? autorizacion.slice(7) : null;
  if (!adminSecretMatches(clave, process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
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
    // El mensaje de ethers incluye la transacción y datos del proveedor RPC:
    // ni se devuelve ni se registra entero.
    registrarError("propuesta no creada", error);
    return NextResponse.json({ error: "No se ha podido crear la propuesta." }, { status: 500 });
  }
}
