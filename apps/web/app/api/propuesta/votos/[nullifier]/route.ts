import { NextResponse } from "next/server";
import {
  OPCIONES,
  contratoLectura,
  nullifierABytes32,
  propuestaIdBytes32,
} from "../../../../../lib/contrato";
import { obtenerPropuesta } from "../../../../../lib/propuestas-store";
import { resultadosVisibles } from "../../../../../lib/resultados-visibles.mjs";

export async function GET(
  request: Request,
  { params }: { params: { nullifier: string } }
) {
  const propuestaId = new URL(request.url).searchParams.get("propuestaId");
  if (!propuestaId) {
    return NextResponse.json({ error: "Falta propuestaId" }, { status: 400 });
  }

  const propuesta = await obtenerPropuesta(propuestaId);
  if (!propuesta) {
    return NextResponse.json({ error: "Propuesta inexistente" }, { status: 404 });
  }
  if (!resultadosVisibles(propuesta.fechaCierre)) {
    return NextResponse.json({ error: "Los recibos estarán disponibles tras el cierre." }, { status: 423 });
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

  // Muchos proveedores RPC publicos (el usado en Sepolia para esta demo
  // incluido) limitan el rango de bloques permitido en eth_getLogs y
  // rechazan un queryFilter sin acotar; el timestamp es solo un extra para
  // mostrar, asi que si esta consulta falla no debe tirar abajo la
  // respuesta (el voto ya se ha confirmado con votoDe() arriba).
  let timestamp: number | null = null;
  try {
    const eventos = await contrato.queryFilter(
      contrato.filters.VotoEmitido(idBytes32, nullifierBytes32)
    );
    const bloque = eventos[0] ? await eventos[0].getBlock() : null;
    timestamp = bloque ? bloque.timestamp * 1000 : null;
  } catch (error) {
    console.error("No se ha podido obtener el timestamp del voto:", error);
  }

  return NextResponse.json({
    encontrado: true,
    opcion: OPCIONES[Number(opcion)],
    timestamp,
  });
}
