"use client";

import { useState } from "react";
import Script from "next/script";
import type { Propuesta } from "@civora/shared-types";
import { edadCumplida } from "../../lib/validacion-dni";
import type { Identificacion } from "./identificacion";
import { useModoSencillo } from "./ModoSencillo";
import { mensajeParaVotante } from "../../lib/modo-sencillo.mjs";

declare global {
  interface Window {
    AutoScript?: {
      cargarAppAfirma: (clientAddress?: string, keystore?: string) => void;
      sign: (
        dataB64: string,
        algoritmo: string,
        formato: string,
        parametrosExtra: string,
        onExito: (firmaB64: string, certB64: string) => void,
        onError: (tipoError: string, mensaje: string) => void
      ) => void;
    };
  }
}

type Estado = "formulario" | "firmando" | "error";

/**
 * Datos del formulario, guardados en el asistente para no perderlos si hay
 * que repetir la firma (por ejemplo, cuando caduca el reto).
 */
export type DatosCertificado = { fechaNacimiento: string; declaracion: boolean };

const ERROR_SENCILLO = "No se ha podido completar la firma. Inténtelo de nuevo o pida ayuda.";

function hexABase64(hex: string): string {
  const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

export function IdentificacionCertificado({
  propuesta,
  datos,
  onCambiarDatos,
  reintento = false,
  onVerificado,
  onCambiarMetodo,
}: {
  propuesta: Propuesta;
  datos: DatosCertificado;
  onCambiarDatos: (datos: DatosCertificado) => void;
  /** Se está repitiendo la firma tras caducar el reto anterior. */
  reintento?: boolean;
  onVerificado: (identificacion: Identificacion) => void;
  onCambiarMetodo: () => void;
}) {
  const { sencillo } = useModoSencillo();
  const { fechaNacimiento, declaracion } = datos;
  const [autoscriptListo, setAutoscriptListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("formulario");
  const [error, setError] = useState<string | null>(null);

  async function firmar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!fechaNacimiento) {
      setError(sencillo ? "Escriba su fecha de nacimiento." : "Introduce tu fecha de nacimiento.");
      return;
    }
    if (!edadCumplida(fechaNacimiento, propuesta.elegibilidad.edadMinima)) {
      setError(
        sencillo
          ? `Para votar hay que tener al menos ${propuesta.elegibilidad.edadMinima} años.`
          : `Debes tener al menos ${propuesta.elegibilidad.edadMinima} años para votar.`
      );
      return;
    }
    if (!declaracion) {
      setError(
        sencillo
          ? "Marque la casilla de la declaración para continuar."
          : "Debes confirmar la declaración responsable para continuar."
      );
      return;
    }
    if (!autoscriptListo || !window.AutoScript) {
      setError(
        sencillo
          ? "El programa Autofirma todavía se está abriendo. Espere un momento e inténtelo de nuevo."
          : "Autofirma todavía se está cargando; espera un momento e inténtalo de nuevo."
      );
      return;
    }

    setEstado("firmando");
    try {
      const respuestaReto = await fetch("/api/identidad/certificado/reto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propuestaId: propuesta.id }),
      });
      if (!respuestaReto.ok) {
        setError("No se ha podido preparar la verificación.");
        setEstado("error");
        return;
      }
      const { reto, timestamp } = (await respuestaReto.json()) as { reto: string; timestamp: number };

      const retoBase64 = hexABase64(reto);

      window.AutoScript.sign(
        retoBase64,
        "SHA256withRSA",
        "CAdES",
        "mode=explicit\nformat=CAdES",
        (firmaB64, certB64) => {
          onVerificado({
            tipo: "certificado",
            propuestaId: propuesta.id,
            timestamp,
            reto,
            signatureB64: firmaB64,
            certB64,
          });
        },
        (_tipoError, mensaje) => {
          setError(mensaje || "No se ha podido firmar con Autofirma.");
          setEstado("error");
        }
      );
    } catch (error) {
      console.error("Fallo al firmar con certificado digital:", error);
      const detalle = error instanceof Error ? error.message : String(error);
      setError(`No se ha podido contactar con el servidor (${detalle}).`);
      setEstado("error");
    }
  }

  return (
    <div className="panel">
      <Script
        src="/js/autoscript.js"
        strategy="afterInteractive"
        onReady={() => {
          window.AutoScript?.cargarAppAfirma();
          setAutoscriptListo(true);
        }}
      />

      <button type="button" className="link-quiet metodo-volver" onClick={onCambiarMetodo}>
        ← {sencillo ? "Elegir otra forma" : "Elegir otro método"}
      </button>

      {sencillo ? (
        <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
          Necesita tener en este ordenador su certificado digital y el programa
          Autofirma. Cuando pulse el botón, Autofirma le pedirá que firme: así
          sabemos que es usted.
        </p>
      ) : (
        <>
          <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
            Firmas un código aleatorio con tu certificado digital (FNMT, DNIe...)
            usando Autofirma, la herramienta oficial del Gobierno de España.
            Necesitas tenerla instalada. Verificamos la firma y que tu
            certificado esté emitido por una autoridad real (FNMT o la DGP), sin
            enviar tu certificado a ningún sitio salvo este servidor.
          </p>

          <p className="form-hint" style={{ marginBottom: 20 }}>
            Tu certificado prueba tu identidad, pero no contiene tu fecha de
            nacimiento: la edad se acepta autodeclarada, igual que en la vía
            manual.
          </p>
        </>
      )}

      {estado !== "error" ? (
        <form onSubmit={firmar}>
          <div className="form-field">
            <label htmlFor="fecha-nacimiento-cert">Fecha de nacimiento</label>
            <input
              id="fecha-nacimiento-cert"
              type="date"
              value={fechaNacimiento}
              onChange={(evento) => onCambiarDatos({ ...datos, fechaNacimiento: evento.target.value })}
            />
          </div>

          <label className="form-check">
            <input
              type="checkbox"
              checked={declaracion}
              onChange={(evento) => onCambiarDatos({ ...datos, declaracion: evento.target.checked })}
            />
            <span>
              {sencillo
                ? "Declaro que mi fecha de nacimiento es cierta y que cumplo los requisitos para votar: estar empadronado en España y vivir aquí desde hace al menos 5 años."
                : "Declaro que la fecha de nacimiento es cierta y que cumplo el resto de requisitos de elegibilidad (empadronamiento y residencia continuada)."}
            </span>
          </label>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={estado === "firmando"}>
            {estado === "firmando"
              ? "Esperando a Autofirma…"
              : reintento
                ? "Firmar de nuevo"
                : sencillo
                  ? "Firmar con mi certificado"
                  : "Firmar con certificado digital"}
          </button>
        </form>
      ) : (
        <>
          <div className="alert alert-error" role="alert">
            {mensajeParaVotante(error ?? ERROR_SENCILLO, sencillo, ERROR_SENCILLO)}
          </div>
          <button type="button" className="btn-primary" onClick={() => setEstado("formulario")}>
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
