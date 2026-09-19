"use client";

import { useState } from "react";
import Script from "next/script";
import type { Propuesta } from "@civora/shared-types";
import { edadCumplida } from "../../lib/validacion-dni";
import type { Identificacion } from "./identificacion";

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

function hexABase64(hex: string): string {
  const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

export function IdentificacionCertificado({
  propuesta,
  onVerificado,
  onCambiarMetodo,
}: {
  propuesta: Propuesta;
  onVerificado: (identificacion: Identificacion) => void;
  onCambiarMetodo: () => void;
}) {
  const [autoscriptListo, setAutoscriptListo] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [declaracion, setDeclaracion] = useState(false);
  const [estado, setEstado] = useState<Estado>("formulario");
  const [error, setError] = useState<string | null>(null);

  async function firmar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!fechaNacimiento) {
      setError("Introduce tu fecha de nacimiento.");
      return;
    }
    if (!edadCumplida(fechaNacimiento, propuesta.elegibilidad.edadMinima)) {
      setError(`Debes tener al menos ${propuesta.elegibilidad.edadMinima} años para votar.`);
      return;
    }
    if (!declaracion) {
      setError("Debes confirmar la declaración responsable para continuar.");
      return;
    }
    if (!autoscriptListo || !window.AutoScript) {
      setError("Autofirma todavía se está cargando; espera un momento e inténtalo de nuevo.");
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
        ← Elegir otro método
      </button>

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

      {estado !== "error" ? (
        <form onSubmit={firmar}>
          <div className="form-field">
            <label htmlFor="fecha-nacimiento-cert">Fecha de nacimiento</label>
            <input
              id="fecha-nacimiento-cert"
              type="date"
              value={fechaNacimiento}
              onChange={(evento) => setFechaNacimiento(evento.target.value)}
            />
          </div>

          <label className="form-check">
            <input
              type="checkbox"
              checked={declaracion}
              onChange={(evento) => setDeclaracion(evento.target.checked)}
            />
            <span>
              Declaro que la fecha de nacimiento es cierta y que cumplo el
              resto de requisitos de elegibilidad (empadronamiento y
              residencia continuada).
            </span>
          </label>

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn-primary" type="submit" disabled={estado === "firmando"}>
            {estado === "firmando" ? "Esperando a Autofirma…" : "Firmar con certificado digital"}
          </button>
        </form>
      ) : (
        <>
          <div className="alert alert-error">{error}</div>
          <button type="button" className="btn-primary" onClick={() => setEstado("formulario")}>
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
