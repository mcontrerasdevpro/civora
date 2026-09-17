import { NextResponse } from "next/server";
import { derivarNullifierZk, verificarPruebaServidor } from "@civora/zk-identity";
import { obtenerPropuesta } from "../../../../../lib/propuestas-store";

/**
 * El navegador ya recibio `verified` en el callback `onResult` del SDK,
 * pero eso es una afirmacion del propio cliente: aqui se repite la
 * verificacion de las pruebas contra ZKPassport para no confiar en ella.
 * Solo si esta segunda verificacion es valida se calcula y se devuelve el
 * nullifier; el identificador unico que entrega ZKPassport nunca sale de
 * este endpoint.
 */
export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);

  if (
    !cuerpo ||
    typeof cuerpo !== "object" ||
    typeof cuerpo.propuestaId !== "string" ||
    !Array.isArray(cuerpo.proofs) ||
    !cuerpo.query ||
    !cuerpo.queryResult
  ) {
    return NextResponse.json({ error: "Solicitud de verificacion invalida." }, { status: 400 });
  }

  if (!(await obtenerPropuesta(cuerpo.propuestaId))) {
    return NextResponse.json({ error: "Propuesta inexistente." }, { status: 404 });
  }

  const resultado = await verificarPruebaServidor({
    proofs: cuerpo.proofs,
    query: cuerpo.query,
    queryResult: cuerpo.queryResult,
    propuestaId: cuerpo.propuestaId,
  });

  if (!resultado.valido || !resultado.identificadorUnico) {
    return NextResponse.json(
      { error: "La prueba de elegibilidad no es valida.", detalles: resultado.errores },
      { status: 400 }
    );
  }

  const nullifier = await derivarNullifierZk(cuerpo.propuestaId, resultado.identificadorUnico);

  return NextResponse.json({ nullifier });
}
