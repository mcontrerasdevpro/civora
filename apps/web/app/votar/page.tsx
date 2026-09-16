"use client";

import { useState } from "react";
import Link from "next/link";
import type { OpcionVoto } from "@civora/shared-types";
import { PROPUESTA_DEMO } from "../../lib/propuesta-demo";
import { derivarNullifierDemo } from "../../lib/nullifier-demo";

/**
 * Flujo de voto, en 3 pasos:
 *  1. Identificación -> deriva un nullifier de forma local (demo).
 *     En producción esto pasa por packages/zk-identity (ZKPassport /
 *     DNIe), integración real pendiente (ver README).
 *  2. Emisión del voto, enviado con el nullifier, no con la identidad.
 *  3. Recibo, para verificar el voto más tarde en /verificar.
 */

const ETIQUETAS_OPCION: Record<OpcionVoto, string> = {
  a_favor: "A favor",
  en_contra: "En contra",
  abstencion: "Abstención",
};

type Paso = "identificacion" | "voto" | "recibo";

export default function VotarPage() {
  const [paso, setPaso] = useState<Paso>("identificacion");
  const [documento, setDocumento] = useState("");
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [opcion, setOpcion] = useState<OpcionVoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function identificarse(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    if (documento.trim().length < 5) {
      setError("Introduce un número de DNI válido.");
      return;
    }
    const derivado = await derivarNullifierDemo(PROPUESTA_DEMO.id, documento);
    setNullifier(derivado);
    setPaso("voto");
  }

  async function votar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!opcion || !nullifier) return;
    setError(null);
    setEnviando(true);
    try {
      const respuesta = await fetch("/api/propuesta/votos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: "voto/v1",
          propuestaId: PROPUESTA_DEMO.id,
          opcion,
          nullifier,
          pruebaZk: `demo:${nullifier}`,
        }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se ha podido registrar el voto.");
        return;
      }
      setPaso("recibo");
    } catch {
      setError("No se ha podido contactar con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <span className="badge-demo">modo demo</span>
        <h1>Votar</h1>
        <p>{PROPUESTA_DEMO.pregunta}</p>
      </div>

      <div className="wizard-steps">
        <span className={paso === "identificacion" ? "activo" : "hecho"}>
          01 · Identificación
        </span>
        <span className={paso === "voto" ? "activo" : paso === "recibo" ? "hecho" : ""}>
          02 · Voto
        </span>
        <span className={paso === "recibo" ? "activo" : ""}>03 · Recibo</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {paso === "identificacion" && (
        <form className="panel" onSubmit={identificarse}>
          <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
            La identificación real por DNIe/certificado digital (vía{" "}
            <code>@civora/zk-identity</code>) está pendiente de
            integrar. En este demo, tu número de DNI se usa solo en tu
            navegador para derivar un identificador único y nunca se envía
            al servidor.
          </p>
          <div className="form-field">
            <label htmlFor="documento">Número de DNI</label>
            <input
              id="documento"
              type="text"
              placeholder="12345678A"
              value={documento}
              onChange={(evento) => setDocumento(evento.target.value)}
              autoComplete="off"
            />
            <p className="form-hint">
              No se almacena. Solo se usa para calcular tu prueba de
              elegibilidad.
            </p>
          </div>
          <button className="btn-primary" type="submit">
            Generar prueba de elegibilidad
          </button>
        </form>
      )}

      {paso === "voto" && (
        <form className="panel" onSubmit={votar}>
          <div className="opciones-voto">
            {PROPUESTA_DEMO.opciones.map((valor) => (
              <label className="opcion-voto" key={valor}>
                <input
                  type="radio"
                  name="opcion"
                  value={valor}
                  checked={opcion === valor}
                  onChange={() => setOpcion(valor)}
                />
                {ETIQUETAS_OPCION[valor]}
              </label>
            ))}
          </div>
          <button className="btn-primary" type="submit" disabled={!opcion || enviando}>
            {enviando ? "Enviando…" : "Emitir voto"}
          </button>
        </form>
      )}

      {paso === "recibo" && nullifier && (
        <div className="panel">
          <div className="alert alert-ok">Tu voto ha sido registrado.</div>
          <p>Guarda este recibo para verificar tu voto más tarde:</p>
          <div className="recibo">{nullifier}</div>
          <Link className="link-quiet" href={`/verificar?nullifier=${nullifier}`}>
            Verificar mi voto ahora
          </Link>
        </div>
      )}
    </main>
  );
}
