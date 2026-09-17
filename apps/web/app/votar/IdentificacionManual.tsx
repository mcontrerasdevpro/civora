"use client";

import { useState } from "react";
import type { Propuesta } from "@civora/shared-types";
import { derivarNullifierManual } from "../../lib/nullifier-manual";
import { dniValido, edadCumplida, normalizarDni } from "../../lib/validacion-dni";
import type { Identificacion } from "./identificacion";

export function IdentificacionManual({
  propuesta,
  onVerificado,
  onCambiarMetodo,
}: {
  propuesta: Propuesta;
  onVerificado: (identificacion: Identificacion) => void;
  onCambiarMetodo: () => void;
}) {
  const [dni, setDni] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [declaracion, setDeclaracion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!dniValido(dni)) {
      setError("El DNI no es válido: comprueba el número y la letra.");
      return;
    }
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

    const nullifier = await derivarNullifierManual(propuesta.id, normalizarDni(dni));
    onVerificado({ tipo: "manual", nullifier });
  }

  return (
    <form className="panel" onSubmit={enviar}>
      <button
        type="button"
        className="link-quiet metodo-volver"
        onClick={onCambiarMetodo}
      >
        ← Elegir otro método
      </button>

      <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
        Esta vía solo comprueba el formato del DNI y la edad que declaras: no
        contrasta con ningún registro oficial (empadronamiento, residencia).
        Nada de esto se envía al servidor hasta que generes el voto.
      </p>

      <div className="form-field">
        <label htmlFor="dni">Número de DNI</label>
        <input
          id="dni"
          type="text"
          placeholder="12345678A"
          value={dni}
          onChange={(evento) => setDni(evento.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="form-field">
        <label htmlFor="fecha-nacimiento">Fecha de nacimiento</label>
        <input
          id="fecha-nacimiento"
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
          Declaro que los datos introducidos son ciertos y que cumplo el
          resto de requisitos de elegibilidad (empadronamiento y residencia
          continuada).
        </span>
      </label>

      {error && <div className="alert alert-error">{error}</div>}

      <button className="btn-primary" type="submit">
        Generar prueba de elegibilidad
      </button>
    </form>
  );
}
