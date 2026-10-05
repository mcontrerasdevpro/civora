import { toUtf8Bytes } from "ethers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { OpcionVotoSchema } from "@civora/shared-types";
import { obtenerPropuesta } from "../../../../../lib/propuestas-store";
import { derivarNullifierCertificado, verificarFirmaCertificado } from "../../../../../lib/certificado-digital";
import { OPCIONES, contratoEscritura, nullifierABytes32, propuestaIdBytes32 } from "../../../../../lib/contrato";

/**
 * Voto con certificado digital (FNMT/DNIe vía Autofirma). A diferencia de
 * votarConPruebaZk, aqui no hay un verificador on-chain: la firma se
 * verifica en este servidor (ver lib/certificado-digital.ts) y el nullifier
 * que resulta se envia al contrato por la via "manual" existente, con una
 * nota que dice de donde viene, para quien audite los eventos on-chain.
 */
const CuerpoSchema = z.object({
  propuestaId: z.string().uuid(),
  opcion: OpcionVotoSchema,
  timestamp: z.number().int().positive(),
  reto: z.string().regex(/^[0-9a-f]{64}$/),
  signatureB64: z.string().min(1),
  certB64: z.string().min(1),
});

function mensajeRevert(error: unknown): string | null {
  const conRazon = error as { reason?: string; shortMessage?: string };
  return conRazon.reason ?? conRazon.shortMessage ?? null;
}

export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const parseo = CuerpoSchema.safeParse(cuerpo);
  if (!parseo.success) {
    return NextResponse.json(
      { error: "Solicitud de voto inválida.", detalles: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const { propuestaId, opcion, timestamp, reto, signatureB64, certB64 } = parseo.data;

  if (!(await obtenerPropuesta(propuestaId))) {
    return NextResponse.json({ error: "Propuesta inexistente." }, { status: 404 });
  }

  const verificacion = await verificarFirmaCertificado({ propuestaId, timestamp, reto, signatureB64, certB64 });
  if (!verificacion.valido || !verificacion.identificador) {
    return NextResponse.json({ error: verificacion.error ?? "Certificado no válido." }, { status: 400 });
  }

  const nullifier = await derivarNullifierCertificado(propuestaId, verificacion.identificador);
  const nullifierBytes32 = nullifierABytes32(nullifier);

  try {
    const contrato = contratoEscritura();
    const tx = await contrato.votarManual(
      propuestaIdBytes32(propuestaId),
      nullifierBytes32,
      OPCIONES.indexOf(opcion),
      toUtf8Bytes(`certificado:${nullifier}`)
    );
    await tx.wait();
  } catch (error) {
    const razon = mensajeRevert(error) ?? "";
    if (razon.includes("ya ha votado")) {
      return NextResponse.json({ error: razon }, { status: 409 });
    }
    if (
      razon.includes("Propuesta inexistente") ||
      razon.includes("Votacion cerrada") ||
      razon.includes("todavia no ha comenzado")
    ) {
      return NextResponse.json({ error: razon }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, nullifier });
}
