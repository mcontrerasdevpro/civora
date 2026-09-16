import { toUtf8Bytes } from "ethers";
import { NextResponse } from "next/server";
import { VotoSchema } from "@civora/shared-types";
import { PROPUESTA_DEMO } from "../../../../lib/propuesta-demo";
import {
  OPCIONES,
  PROPUESTA_ID_BYTES32,
  contratoEscritura,
  leerResultados,
  nullifierABytes32,
} from "../../../../lib/contrato";

const CuerpoVotoSchema = VotoSchema.omit({ timestamp: true });

function mensajeRevert(error: unknown): string | null {
  const conRazon = error as { reason?: string; shortMessage?: string };
  return conRazon.reason ?? conRazon.shortMessage ?? null;
}

export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const parseo = CuerpoVotoSchema.safeParse(cuerpo);

  if (!parseo.success) {
    return NextResponse.json(
      { error: "Voto invalido", detalles: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const voto = parseo.data;

  if (voto.propuestaId !== PROPUESTA_DEMO.id) {
    return NextResponse.json({ error: "Propuesta inexistente" }, { status: 404 });
  }

  const opcionIndex = OPCIONES.indexOf(voto.opcion);
  let nullifierBytes32: string;
  try {
    nullifierBytes32 = nullifierABytes32(voto.nullifier);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  try {
    const contrato = contratoEscritura();
    const tx = await contrato.votar(
      PROPUESTA_ID_BYTES32,
      nullifierBytes32,
      opcionIndex,
      toUtf8Bytes(voto.pruebaZk)
    );
    await tx.wait();
  } catch (error) {
    const razon = mensajeRevert(error) ?? "";
    if (razon.includes("ya ha votado")) {
      return NextResponse.json({ error: razon }, { status: 409 });
    }
    if (razon.includes("Propuesta inexistente") || razon.includes("Votacion cerrada")) {
      return NextResponse.json({ error: razon }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({
    ok: true,
    nullifier: voto.nullifier,
    resultados: await leerResultados(),
  });
}
