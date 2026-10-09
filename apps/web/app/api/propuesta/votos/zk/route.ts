import { NextResponse } from "next/server";
import { z } from "zod";
import { OpcionVotoSchema } from "@civora/shared-types";
import { obtenerPropuesta, viasPermitidasDe } from "../../../../../lib/propuestas-store";
import { OPCIONES, votarConPruebaZkOnChain } from "../../../../../lib/contrato";
import { registrarAviso, registrarError } from "../../../../../lib/registro.mjs";
import { esRechazoDelContrato, selectorDeRevert } from "../../../../../lib/errores-contrato.mjs";
import { viaPermitida } from "../../../../../lib/vias-voto.mjs";
import { registrarIntentoRepetido } from "../../../../../lib/intentos-repetidos";

/**
 * Voto con prueba ZKPassport verificada dentro del propio contrato (ver
 * VotacionAnonima.votarConPruebaZk): a diferencia de /api/propuesta/votos,
 * aqui no se recibe ni se confia en ningun nullifier calculado por el
 * cliente. El contrato calcula el nullifier a partir de la prueba, ya
 * verificada, y esta ruta solo relaya la transaccion.
 *
 * Voto único (A-04): solo se admite si la propuesta tiene fijada la vía ZK
 * en el contrato y sigue en VIAS_HABILITADAS. El contrato lo exige también,
 * así que una llamada directa a votarConPruebaZk se rechaza igual.
 */
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Se esperaba un valor de 32 bytes en hexadecimal.");
const bytesHex = z.string().regex(/^0x([0-9a-fA-F]{2})*$/, "Se esperaba una cadena de bytes en hexadecimal.");

const CuerpoSchema = z.object({
  propuestaId: z.string().uuid(),
  opcion: OpcionVotoSchema,
  parametrosVerificacion: z.object({
    version: bytes32,
    proofVerificationData: z.object({
      vkeyHash: bytes32,
      proof: bytesHex,
      publicInputs: z.array(bytes32),
    }),
    committedInputs: bytesHex,
    serviceConfig: z.object({
      validityPeriodInSeconds: z.number(),
      domain: z.string(),
      scope: z.string(),
      devMode: z.boolean(),
    }),
  }),
});

function mensajeRevert(error: unknown): string | null {
  const conRazon = error as { reason?: string; shortMessage?: string; message?: string };
  return conRazon.reason ?? conRazon.shortMessage ?? conRazon.message ?? null;
}

/** Traduce los nombres de los errores personalizados de VotacionAnonima.sol. */
const MENSAJES_ERROR_CONTRATO: Record<string, string> = {
  PruebaInvalida: "La prueba no ha superado la verificación criptográfica.",
  AmbitoIncorrecto: "La prueba no se generó para esta propuesta.",
  PruebaCaducada: "La prueba ha caducado; genera una nueva desde /votar.",
  ModoDesarrolloNoPermitido: "Esta prueba es de un documento simulado (modo desarrollo), no aceptado aquí.",
  NoCumpleEdadMinima: "La prueba no acredita la edad mínima requerida.",
  NacionalidadNoValida: "La prueba no acredita nacionalidad española.",
  OpcionNoVinculada: "La prueba no se generó para esta opción; genera una nueva desde /votar.",
};

export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const parseo = CuerpoSchema.safeParse(cuerpo);

  if (!parseo.success) {
    return NextResponse.json(
      { error: "Solicitud de voto invalida.", detalles: parseo.error.flatten() },
      { status: 400 }
    );
  }

  const { propuestaId, opcion, parametrosVerificacion } = parseo.data;

  if (!(await obtenerPropuesta(propuestaId))) {
    return NextResponse.json({ error: "Propuesta inexistente" }, { status: 404 });
  }

  if (!viaPermitida(await viasPermitidasDe(propuestaId), "zk")) {
    await registrarIntentoRepetido({ propuestaId, via: "zk", motivo: "via-no-permitida", nullifier: null });
    return NextResponse.json(
      { error: "En esta votación no se admite esta forma de identificarse. Vuelva a /votar y elija otra." },
      { status: 403 }
    );
  }

  let nullifier: string;
  try {
    const resultado = await votarConPruebaZkOnChain({
      propuestaId,
      opcionIndex: OPCIONES.indexOf(opcion),
      parametrosVerificacion,
    });
    nullifier = resultado.nullifier;
  } catch (error) {
    const razon = mensajeRevert(error) ?? "";

    if (razon.includes("ViaNoPermitida")) {
      await registrarIntentoRepetido({ propuestaId, via: "zk", motivo: "via-no-permitida", nullifier: null });
      return NextResponse.json(
        { error: "En esta votación no se admite esta forma de identificarse. Vuelva a /votar y elija otra." },
        { status: 403 }
      );
    }

    const nombreError = Object.keys(MENSAJES_ERROR_CONTRATO).find((nombre) => razon.includes(nombre));
    if (nombreError) {
      return NextResponse.json({ error: MENSAJES_ERROR_CONTRATO[nombreError] }, { status: 400 });
    }
    if (razon.includes("ya ha votado")) {
      // El servidor no ve el identificador de ZKPassport si el contrato
      // rechaza el voto: los intentos se agregan por propuesta.
      await registrarIntentoRepetido({ propuestaId, via: "zk", motivo: "voto-repetido", nullifier: null });
      return NextResponse.json({ error: razon }, { status: 409 });
    }
    if (razon.includes("Propuesta inexistente") || razon.includes("Votacion cerrada") || razon.includes("todavia no ha comenzado")) {
      return NextResponse.json({ error: razon }, { status: 400 });
    }
    if (esRechazoDelContrato(error)) {
      // Rechazo del contrato o del verificador de ZKPassport que no tiene
      // mensaje propio: se registra solo su selector (sin datos del votante).
      registrarAviso("voto zk rechazado por el contrato", selectorDeRevert(error) ?? "sin selector");
      return NextResponse.json(
        {
          error:
            process.env.NEXT_PUBLIC_ZKPASSPORT_DEV_MODE === "true"
              ? "El contrato ha rechazado la prueba. En esta demostración solo valen los pasaportes simulados de la app ZKPassport."
              : "El contrato ha rechazado la prueba de identidad.",
        },
        { status: 400 }
      );
    }
    // No se relanza: Next registraría el error entero, con la transacción.
    registrarError("voto zk no registrado", error);
    return NextResponse.json({ error: "No se ha podido registrar el voto." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, nullifier });
}
