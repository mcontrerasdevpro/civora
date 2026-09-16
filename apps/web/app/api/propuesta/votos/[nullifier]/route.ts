import { NextResponse } from "next/server";
import { OPCIONES, PROPUESTA_ID_BYTES32, contratoLectura, nullifierABytes32 } from "../../../../../lib/contrato";

export async function GET(
  _request: Request,
  { params }: { params: { nullifier: string } }
) {
  let nullifierBytes32: string;
  try {
    nullifierBytes32 = nullifierABytes32(params.nullifier);
  } catch {
    return NextResponse.json({ encontrado: false });
  }

  const contrato = contratoLectura();
  const [registrado, opcion]: [boolean, bigint] = await contrato.votoDe(
    PROPUESTA_ID_BYTES32,
    nullifierBytes32
  );

  if (!registrado) {
    return NextResponse.json({ encontrado: false });
  }

  const eventos = await contrato.queryFilter(
    contrato.filters.VotoEmitido(PROPUESTA_ID_BYTES32, nullifierBytes32)
  );
  const bloque = eventos[0] ? await eventos[0].getBlock() : null;

  return NextResponse.json({
    encontrado: true,
    opcion: OPCIONES[Number(opcion)],
    timestamp: bloque ? bloque.timestamp * 1000 : null,
  });
}
