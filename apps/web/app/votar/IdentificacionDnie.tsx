"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  crearSolicitudVerificacion,
  obtenerParametrosVerificacionOnChain,
  type SolidityVerifierParameters,
} from "@civora/zk-identity";
import type { OpcionVoto, Propuesta } from "@civora/shared-types";
import type { Identificacion } from "./identificacion";
import { useModoSencillo } from "./ModoSencillo";
import { mensajeParaVotante } from "../../lib/modo-sencillo.mjs";

/**
 * Prepara la vía DNIe/pasaporte. La prueba ZKPassport no se genera aquí,
 * sino al confirmar el voto (PruebaZk), porque lleva la opción vinculada
 * (R-01): una prueba generada antes de elegir no serviría para votar.
 */
export function IdentificacionDnie({
  onVerificado,
  onCambiarMetodo,
}: {
  onVerificado: (identificacion: Identificacion) => void;
  onCambiarMetodo: () => void;
}) {
  const { sencillo } = useModoSencillo();

  return (
    <div className="panel">
      <button type="button" className="link-quiet metodo-volver" onClick={onCambiarMetodo}>
        ← {sencillo ? "Elegir otra forma" : "Elegir otro método"}
      </button>

      {sencillo ? (
        <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
          Necesita la app ZKPassport en su móvil. Primero elija su respuesta.
          Después, al confirmarla, aparecerá un código: léalo con la app y
          acerque su DNI o pasaporte a la parte de atrás del móvil. Sus datos
          no se envían a esta web.
        </p>
      ) : (
        <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
          Necesitas la app móvil de{" "}
          <a href="https://zkpassport.id" target="_blank" rel="noreferrer" className="link-quiet">
            ZKPassport
          </a>{" "}
          y tu DNIe o pasaporte con chip NFC. Primero elige tu opción; al
          confirmarla aparecerá un código QR para escanear con la app. La app
          genera una prueba de que cumples los requisitos (edad, nacionalidad)
          que incluye tu opción, sin enviar tu documento ni tus datos
          personales a este servidor: la prueba se verifica dentro del propio
          contrato al emitir el voto.
        </p>
      )}

      <button className="btn-primary" type="button" onClick={() => onVerificado({ tipo: "zk" })}>
        Continuar
      </button>
    </div>
  );
}

type Estado = "iniciando" | "esperando" | "generando" | "preparando" | "error";

const MENSAJES: Record<Estado, string> = {
  iniciando: "Preparando la solicitud de verificación…",
  esperando: "Escanea el código con la app de ZKPassport en tu móvil.",
  generando: "Generando la prueba en tu móvil…",
  preparando: "Prueba generada. Enviando tu voto…",
  error: "No se ha podido completar la verificación.",
};

const MENSAJES_SENCILLOS: Record<Estado, string> = {
  iniciando: "Preparando…",
  esperando: "Abra la app ZKPassport en su móvil y apunte la cámara a este código.",
  generando: "Su móvil está comprobando sus datos. Espere, por favor…",
  preparando: "Comprobado. Guardando su voto…",
  error: "No se ha podido comprobar su identidad.",
};

const ERROR_SENCILLO = "No se ha podido comprobar su identidad. Inténtelo de nuevo o elija otra forma.";

/**
 * Pide a la app ZKPassport la prueba de elegibilidad con la opción ya
 * elegida vinculada, y entrega los parámetros que verifica el contrato.
 * Abre una conexión (WebSocket) con la app que vive mientras se muestra.
 */
export function PruebaZk({
  propuesta,
  opcion,
  onPrueba,
  onCancelar,
}: {
  propuesta: Propuesta;
  opcion: OpcionVoto;
  onPrueba: (parametrosVerificacion: SolidityVerifierParameters) => void;
  onCancelar: () => void;
}) {
  const { sencillo } = useModoSencillo();
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const solicitud = await crearSolicitudVerificacion({
          elegibilidad: propuesta.elegibilidad,
          propuestaId: propuesta.id,
          opcion,
        });
        if (cancelado) return;

        setUrl(solicitud.url);
        setEstado("esperando");

        const dataUrl = await QRCode.toDataURL(solicitud.url, { margin: 1, width: 240 });
        if (!cancelado) setQr(dataUrl);

        solicitud.onRequestReceived(() => {
          if (!cancelado) setEstado("esperando");
        });

        solicitud.onGeneratingProof(() => {
          if (!cancelado) setEstado("generando");
        });

        solicitud.onReject(() => {
          if (cancelado) return;
          setMensajeError("Has rechazado la solicitud en la app de ZKPassport.");
          setEstado("error");
        });

        solicitud.onError((mensaje) => {
          if (cancelado) return;
          setMensajeError(mensaje);
          setEstado("error");
        });

        solicitud.onResult(({ verified, proofs }) => {
          if (cancelado) return;

          if (!verified) {
            setMensajeError(
              "No se ha podido generar una prueba válida. Comprueba que cumples los requisitos (mayoría de edad, DNI español)."
            );
            setEstado("error");
            return;
          }

          setEstado("preparando");
          try {
            const parametrosVerificacion = obtenerParametrosVerificacionOnChain({
              proofs,
              propuestaId: propuesta.id,
            });
            // La verificacion real ocurre dentro del contrato al votar
            // (VotacionAnonima.votarConPruebaZk): aqui solo se preparan los
            // parametros, sin confiar en nada todavia.
            onPrueba(parametrosVerificacion);
          } catch (err) {
            setMensajeError(
              err instanceof Error ? err.message : "No se ha podido preparar la prueba para el contrato."
            );
            setEstado("error");
          }
        });
      } catch (err) {
        if (!cancelado) {
          setMensajeError(
            err instanceof Error ? err.message : "No se ha podido iniciar la verificación."
          );
          setEstado("error");
        }
      }
    }

    iniciar();

    return () => {
      cancelado = true;
    };
    // Una sola solicitud/conexión con ZKPassport mientras se muestra; para
    // otra opción, el asistente desmonta y vuelve a montar el componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="prueba-zk">
      {estado === "error" ? (
        <div className="alert alert-error" role="alert">
          {mensajeParaVotante(mensajeError ?? MENSAJES.error, sencillo, ERROR_SENCILLO)}
        </div>
      ) : (
        <>
          {qr && (estado === "esperando" || estado === "generando") && (
            <div className="qr-box">
              <img
                src={qr}
                alt={sencillo ? "Código para leer con la app ZKPassport" : "Código QR para votar con ZKPassport"}
                width={240}
                height={240}
              />
            </div>
          )}
          <p className="estado-zk" role="status">
            {(sencillo ? MENSAJES_SENCILLOS : MENSAJES)[estado]}
          </p>
          {url && estado === "esperando" && (
            <a className="link-quiet" href={url} target="_blank" rel="noreferrer">
              {sencillo
                ? "¿Está usando el móvil? Pulse aquí para abrir la app"
                : "¿Estás viendo esto en el móvil? Abrir directamente en la app"}
            </a>
          )}
        </>
      )}

      {estado !== "preparando" && (
        <button type="button" className="btn-secundario" onClick={onCancelar}>
          {estado === "error" ? "Volver" : "Cancelar"}
        </button>
      )}
    </div>
  );
}
