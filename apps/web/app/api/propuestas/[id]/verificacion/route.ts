import { NextResponse } from "next/server";
import { buscarPropuesta } from "../../../../../lib/propuestas-store";
import { MENSAJE_PROPUESTA_ARCHIVADA } from "../../../../../lib/errores-contrato.mjs";
import { resultadosVisibles } from "../../../../../lib/resultados-visibles.mjs";
import { segmentoDesdeElFinal } from "../../../../../lib/parametros-ruta.mjs";
import { verificacionResultados } from "../../../../../lib/verificacion-resultados";

export const dynamic = "force-dynamic";

/**
 * Datos para comprobar el resultado de una propuesta: contrato, evento,
 * bloques y, si el proveedor RPC lo permite, el recuento rehecho desde los
 * eventos. Igual que los resultados, solo tras el cierre (423 antes).
 */
export async function GET(request: Request) {
  const id = segmentoDesdeElFinal(request, 2);
  const encontrada = await buscarPropuesta(id);
  if (!encontrada) {
    return NextResponse.json({ error: "Propuesta inexistente." }, { status: 404 });
  }
  if (encontrada.archivada) {
    return NextResponse.json({ error: MENSAJE_PROPUESTA_ARCHIVADA, archivada: true }, { status: 410 });
  }
  if (!resultadosVisibles(encontrada.propuesta.fechaCierre)) {
    return NextResponse.json({ error: "La verificación estará disponible tras el cierre." }, { status: 423 });
  }

  return NextResponse.json({ verificacion: await verificacionResultados(encontrada.propuesta) });
}
