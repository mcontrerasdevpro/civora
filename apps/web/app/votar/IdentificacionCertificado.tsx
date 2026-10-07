"use client";

import { useState } from "react";
import Script from "next/script";
import type { Propuesta } from "@civora/shared-types";
import { edadCumplida } from "../../lib/validacion-dni";
import type { Identificacion } from "./identificacion";
import { useModoSencillo } from "./ModoSencillo";
import { autofirmaDisponible } from "./autofirma";

/** Datos del formulario, guardados en el asistente para no perderlos al volver. */
export type DatosCertificado = { fechaNacimiento: string; declaracion: boolean };

/**
 * Prepara la vía de certificado: carga Autofirma y recoge la fecha de
 * nacimiento y la declaración responsable. La firma no se hace aquí, sino
 * al confirmar el voto, porque el reto firmado incluye la opción (R-04).
 */
export function IdentificacionCertificado({
  propuesta,
  datos,
  onCambiarDatos,
  onVerificado,
  onCambiarMetodo,
}: {
  propuesta: Propuesta;
  datos: DatosCertificado;
  onCambiarDatos: (datos: DatosCertificado) => void;
  onVerificado: (identificacion: Identificacion) => void;
  onCambiarMetodo: () => void;
}) {
  const { sencillo } = useModoSencillo();
  const { fechaNacimiento, declaracion } = datos;
  const [autoscriptListo, setAutoscriptListo] = useState(autofirmaDisponible);
  const [error, setError] = useState<string | null>(null);

  function continuar(evento: React.FormEvent) {
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
    if (!autoscriptListo || !autofirmaDisponible()) {
      setError(
        sencillo
          ? "El programa Autofirma todavía se está abriendo. Espere un momento e inténtelo de nuevo."
          : "Autofirma todavía se está cargando; espera un momento e inténtalo de nuevo."
      );
      return;
    }

    onVerificado({ tipo: "certificado" });
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
          Autofirma. Después de elegir y confirmar su voto, Autofirma le pedirá
          que lo firme: así sabemos que es usted.
        </p>
      ) : (
        <>
          <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
            Al confirmar tu voto firmarás un código aleatorio, que incluye tu
            opción, con tu certificado digital (FNMT, DNIe...) usando Autofirma,
            la herramienta oficial del Gobierno de España. Necesitas tenerla
            instalada. Verificamos la firma y que tu certificado esté emitido
            por una autoridad real (FNMT o la DGP); la firma y el certificado no
            se guardan.
          </p>

          <p className="form-hint" style={{ marginBottom: 20 }}>
            Tu certificado prueba tu identidad, pero no contiene tu fecha de
            nacimiento: la edad se acepta autodeclarada.
          </p>
        </>
      )}

      <form onSubmit={continuar}>
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

        <button className="btn-primary" type="submit">
          Continuar
        </button>
      </form>
    </div>
  );
}
