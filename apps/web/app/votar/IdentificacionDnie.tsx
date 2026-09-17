"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { crearSolicitudVerificacion } from "@civora/zk-identity";
import type { Propuesta } from "@civora/shared-types";

type Estado = "iniciando" | "esperando" | "generando" | "verificando" | "error";

const MENSAJES: Record<Estado, string> = {
  iniciando: "Preparando la solicitud de verificación…",
  esperando: "Escanea el código con la app de ZKPassport en tu móvil.",
  generando: "Generando la prueba de elegibilidad en tu móvil…",
  verificando: "Verificando la prueba en el servidor…",
  error: "No se ha podido completar la verificación.",
};

export function IdentificacionDnie({
  propuesta,
  onVerificado,
  onCambiarMetodo,
}: {
  propuesta: Propuesta;
  onVerificado: (nullifier: string) => void;
  onCambiarMetodo: () => void;
}) {
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

        solicitud.onResult(async ({ verified, uniqueIdentifier, proofs, result }) => {
          if (cancelado) return;

          if (!verified || !uniqueIdentifier) {
            setMensajeError(
              "No se ha podido generar una prueba válida. Comprueba que cumples los requisitos (mayoría de edad, DNI español)."
            );
            setEstado("error");
            return;
          }

          setEstado("verificando");
          try {
            const respuesta = await fetch("/api/identidad/zkpassport/verificar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                propuestaId: propuesta.id,
                proofs,
                query: solicitud.query,
                queryResult: result,
              }),
            });
            const cuerpo = await respuesta.json();
            if (cancelado) return;
            if (!respuesta.ok || !cuerpo.nullifier) {
              setMensajeError(cuerpo.error ?? "No se ha podido verificar la prueba en el servidor.");
              setEstado("error");
              return;
            }
            onVerificado(cuerpo.nullifier);
          } catch {
            if (!cancelado) {
              setMensajeError("No se ha podido contactar con el servidor.");
              setEstado("error");
            }
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
    // Se ejecuta una sola vez al montar: crea una única solicitud/conexión
    // con ZKPassport para todo el ciclo de vida de este paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="panel">
      <button type="button" className="link-quiet metodo-volver" onClick={onCambiarMetodo}>
        ← Elegir otro método
      </button>

      <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
        Escanea este código con la app móvil de{" "}
        <a
          href="https://zkpassport.id"
          target="_blank"
          rel="noreferrer"
          className="link-quiet"
        >
          ZKPassport
        </a>{" "}
        tras leer el chip NFC de tu DNIe o pasaporte. La app genera una
        prueba de que cumples los requisitos (edad, nacionalidad) sin enviar
        tu documento ni tus datos personales a este servidor.
      </p>

      {estado === "error" ? (
        <div className="alert alert-error">{mensajeError}</div>
      ) : (
        <>
          {qr && (estado === "esperando" || estado === "generando") && (
            <div className="qr-box">
              <img src={qr} alt="Código QR para verificar tu identidad con ZKPassport" width={240} height={240} />
            </div>
          )}
          <p className="estado-zk">{MENSAJES[estado]}</p>
          {url && estado === "esperando" && (
            <a className="link-quiet" href={url} target="_blank" rel="noreferrer">
              ¿Estás viendo esto en el móvil? Abrir directamente en la app
            </a>
          )}
        </>
      )}

      {estado === "error" && (
        <button type="button" className="btn-primary" onClick={onCambiarMetodo}>
          Elegir otro método
        </button>
      )}
    </div>
  );
}
