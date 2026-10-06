"use client";

import { useModoSencillo } from "./ModoSencillo";

export type MetodoIdentificacion = "dnie" | "certificado";

export function MetodoSelector({
  onElegir,
}: {
  onElegir: (metodo: MetodoIdentificacion) => void;
}) {
  const { sencillo } = useModoSencillo();

  return (
    <div className="panel metodo-selector">
      <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
        {sencillo
          ? "Elija cómo quiere demostrar que puede votar."
          : "Elige cómo quieres acreditar que cumples los requisitos para votar."}
      </p>

      <button type="button" className="metodo-card" onClick={() => onElegir("dnie")}>
        <span className="metodo-card-title">
          {sencillo ? "Con su DNI o pasaporte y el móvil" : "DNIe o pasaporte (NFC)"}
        </span>
        <span className="metodo-card-desc">
          {sencillo
            ? "Recomendado. Necesita la app ZKPassport en su móvil. Sus datos no se envían a esta web."
            : "Recomendado. Verificación real con ZKPassport: escaneas el chip de tu documento con el móvil y se genera una prueba criptográfica, sin enviar tus datos a este servidor."}
        </span>
      </button>

      <button type="button" className="metodo-card" onClick={() => onElegir("certificado")}>
        <span className="metodo-card-title">
          {sencillo ? "Con su certificado digital" : "Certificado digital"}
        </span>
        <span className="metodo-card-desc">
          {sencillo
            ? "Necesita tener en este ordenador su certificado digital y el programa Autofirma."
            : "Firma un código con tu certificado digital (FNMT, DNIe...) usando Autofirma. Prueba tu identidad de verdad, pero no tu edad (el certificado no la contiene), así que se acepta autodeclarada."}
        </span>
      </button>
    </div>
  );
}
