import { NextResponse } from "next/server";
import {
  OPCIONES,
  contratoLectura,
  nullifierABytes32,
  propuestaIdBytes32,
} from "../../../../../lib/contrato";

export async function GET(
  request: Request,
  { params }: { params: { nullifier: string } }
) {
  const propuestaId = new URL(request.url).searchParams.get("propuestaId");
  if (!propuestaId) {
    return NextResponse.json({ error: "Falta propuestaId" }, { status: 400 });
  }

  let nullifierBytes32: string;
  try {
    nullifierBytes32 = nullifierABytes32(params.nullifier);
  } catch {
    return NextResponse.json({ encontrado: false });
  }

  const idBytes32 = propuestaIdBytes32(propuestaId);
  const contrato = contratoLectura();
  const [registrado, opcion]: [boolean, bigint] = await contrato.votoDe(idBytes32, nullifierBytes32);

  if (!registrado) {
    return NextResponse.json({ encontrado: false });
  }

  const eventos = await contrato.queryFilter(
    contrato.filters.VotoEmitido(idBytes32, nullifierBytes32)
  );
  const bloque = eventos[0] ? await eventos[0].getBlock() : null;

  return NextResponse.json({
    encontrado: true,
    opcion: OPCIONES[Number(opcion)],
    timestamp: bloque ? bloque.timestamp * 1000 : null,
  });
}
