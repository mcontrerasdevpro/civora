import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerPropuesta, viasPermitidasDe } from "../../../../lib/propuestas-store";
import { verificarFirmaCertificado } from "../../../../lib/certificado-digital";
import { leerReciboAbstencion, registrarAbstencionNotificada } from "../../../../lib/abstencion-notificada";
import { registrarError } from "../../../../lib/registro.mjs";
import { segmentoFinal } from "../../../../lib/parametros-ruta.mjs";
import { contextoFirmaAbstencion, motivoRechazoAbstencion } from "../../../../lib/contexto-abstencion.mjs";

export const dynamic = "force-dynamic";

const CuerpoSchema = z.object({
  propuestaId: z.string().uuid(),
  timestamp: z.number().int().positive(),
  reto: z.string().regex(/^[0-9a-f]{64}$/),
  signatureB64: z.string().min(1).max(100_000),
  certB64: z.string().min(1).max(100_000),
});

export async function GET(request: Request) {
  const id = segmentoFinal(request);
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Registro inexistente." }, { status: 404 });
  const recibo = await leerReciboAbstencion(id);
  return recibo
    ? NextResponse.json({ recibo })
    : NextResponse.json({ error: "Registro inexistente." }, { status: 404 });
}

export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const parseo = CuerpoSchema.safeParse(cuerpo);
  if (!parseo.success) return NextResponse.json({ error: "Solicitud de abstención inválida." }, { status: 400 });

  const propuesta = await obtenerPropuesta(parseo.data.propuestaId);
  if (!propuesta) return NextResponse.json({ error: "Propuesta inexistente o archivada." }, { status: 404 });
  const rechazo = motivoRechazoAbstencion(propuesta, await viasPermitidasDe(propuesta.id));
  if (rechazo === "no-abierta") {
    return NextResponse.json({ error: "Esta votación todavía no ha comenzado." }, { status: 400 });
  }
  if (rechazo === "cerrada") {
    return NextResponse.json({ error: "El plazo de esta votación ha terminado." }, { status: 400 });
  }
  if (rechazo === "via-no-permitida") {
    return NextResponse.json(
      { error: "Esta votación no admite el certificado digital, que es la única vía para notificar una abstención." },
      { status: 403 }
    );
  }

  const verificacion = await verificarFirmaCertificado({
    ...parseo.data,
    opcion: contextoFirmaAbstencion(propuesta),
  });
  if (!verificacion.valido || !verificacion.identificador) {
    return NextResponse.json({ error: verificacion.error ?? "No se ha podido verificar la firma." }, { status: 400 });
  }

  try {
    const recibo = await registrarAbstencionNotificada(verificacion.identificador, {
      propuestaId: propuesta.id,
      titulo: propuesta.titulo,
      pregunta: propuesta.pregunta,
      fechaApertura: propuesta.fechaApertura,
      fechaCierre: propuesta.fechaCierre,
      fechaDeclaracion: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, recibo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ABSTENCION_YA_REGISTRADA") {
      return NextResponse.json({ error: "Ya existe una abstención notificada para esta persona y votación." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "VOTO_PREVIO") {
      return NextResponse.json({ error: "Ya se ha emitido un voto en esta votación; no puede registrarse una abstención retroactiva." }, { status: 409 });
    }
    registrarError("abstencion notificada no registrada", error);
    return NextResponse.json({ error: "No se ha podido registrar la abstención." }, { status: 500 });
  }
}
