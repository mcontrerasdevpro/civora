"use client";

import { useState } from "react";
import Link from "next/link";
import type { OpcionVoto, Propuesta } from "@civora/shared-types";
import { MetodoSelector, type MetodoIdentificacion } from "./MetodoSelector";
import { IdentificacionDnie } from "./IdentificacionDnie";
import { IdentificacionManual } from "./IdentificacionManual";
import type { Identificacion } from "./identificacion";

/**
 * Flujo de voto, en 3 pasos, para una propuesta concreta:
 *  1. Identificación -> el votante elige DNIe/pasaporte (ZKPassport, prueba
 *     verificada dentro del contrato al votar) o datos manuales (solo
 *     validación de formato, nullifier calculado en el navegador). El
 *     certificado digital está pendiente (requiere TLS mutuo, ver
 *     MetodoSelector).
 *  2. Emisión del voto, enviado con el nullifier (o, en la vía ZK, con la
 *     prueba que el contrato verifica y convierte en nullifier), nunca con
 *     la identidad.
 *  3. Recibo, para verificar el voto más tarde en /verificar.
 */

const ETIQUETAS_OPCION: Record<OpcionVoto, string> = {
  a_favor: "A favor",
  en_contra: "En contra",
  abstencion: "Abstención",
};

type Paso = "identificacion" | "voto" | "recibo";

export function VotarWizard({ propuesta }: { propuesta: Propuesta }) {
  const [paso, setPaso] = useState<Paso>("identificacion");
  const [metodo, setMetodo] = useState<MetodoIdentificacion | null>(null);
  const [identificacion, setIdentificacion] = useState<Identificacion | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [opcion, setOpcion] = useState<OpcionVoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ahora = Date.now();
  const noAbierta = ahora < Date.parse(propuesta.fechaApertura);
  const cerrada = ahora >= Date.parse(propuesta.fechaCierre);

  function identificacionCompletada(valor: Identificacion) {
    setError(null);
    setIdentificacion(valor);
    setPaso("voto");
  }

  async function votar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!opcion || !identificacion) return;
    setError(null);
    setEnviando(true);
    try {
      const respuesta =
        identificacion.tipo === "zk"
          ? await fetch("/api/propuesta/votos/zk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                propuestaId: propuesta.id,
                opcion,
                parametrosVerificacion: identificacion.parametrosVerificacion,
              }),
            })
          : await fetch("/api/propuesta/votos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                schema: "voto/v1",
                propuestaId: propuesta.id,
                opcion,
                nullifier: identificacion.nullifier,
                pruebaZk: `manual:${identificacion.nullifier}`,
              }),
            });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se ha podido registrar el voto.");
        return;
      }
      setNullifier(cuerpo.nullifier);
      setPaso("recibo");
    } catch {
      setError("No se ha podido contactar con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  if (noAbierta) {
    return (
      <div className="alert alert-error">
        Esta votación todavía no ha comenzado. Abre el{" "}
        {new Date(propuesta.fechaApertura).toLocaleString("es-ES")}.
      </div>
    );
  }

  if (cerrada) {
    return (
      <div className="alert alert-error">
        Esta votación ya ha cerrado. Puedes consultar{" "}
        <Link className="link-quiet" href={`/resultados/${propuesta.id}`}>
          los resultados
        </Link>
        .
      </div>
    );
  }

  return (
    <>
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

      {paso === "identificacion" && !metodo && <MetodoSelector onElegir={setMetodo} />}

      {paso === "identificacion" && metodo === "dnie" && (
        <IdentificacionDnie
          propuesta={propuesta}
          onVerificado={identificacionCompletada}
          onCambiarMetodo={() => setMetodo(null)}
        />
      )}

      {paso === "identificacion" && metodo === "manual" && (
        <IdentificacionManual
          propuesta={propuesta}
          onVerificado={identificacionCompletada}
          onCambiarMetodo={() => setMetodo(null)}
        />
      )}

      {paso === "voto" && (
        <form className="panel" onSubmit={votar}>
          <div className="opciones-voto">
            {propuesta.opciones.map((valor) => (
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
          <Link
            className="link-quiet"
            href={`/verificar?propuestaId=${propuesta.id}&nullifier=${nullifier}`}
          >
            Verificar mi voto ahora
          </Link>
        </div>
      )}
    </>
  );
}
