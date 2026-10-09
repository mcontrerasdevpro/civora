"use client";

import { useModoSencillo } from "./ModoSencillo";
import type { ViaVoto } from "../../lib/vias-voto.mjs";

export type MetodoIdentificacion = "dnie" | "certificado";

export function MetodoSelector({
  vias,
  onElegir,
}: {
  vias: readonly ViaVoto[];
  onElegir: (metodo: MetodoIdentificacion) => void;
}) {
  const { sencillo } = useModoSencillo();

  return (
    <div className="panel metodo-selector">
      <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
        {vias.length === 0
          ? sencillo
            ? "Ahora mismo no se puede votar en esta votación. Pida ayuda."
            : "Esta votación no admite ahora ninguna forma de identificarse. Consulta con la organización."
          : vias.length > 1
          ? sencillo
            ? "Elija cómo quiere demostrar que puede votar."
            : "Elige cómo quieres acreditar que cumples los requisitos para votar."
          : sencillo
            ? "En esta votación solo hay una forma de identificarse. Así nadie puede votar dos veces."
            : "En esta votación solo se admite una forma de identificarse: así se garantiza un único voto por persona."}
      </p>

      {vias.includes("zk") && (
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
      )}

      {vias.includes("certificado") && (
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
      )}
    </div>
  );
}
