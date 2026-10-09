"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VIAS, type ViaPropuesta, type ViaVoto } from "../../../lib/vias-voto.mjs";

function fechaLocalPorDefecto(): string {
  const dentroDeUnaHora = new Date(Date.now() + 60 * 60 * 1000);
  dentroDeUnaHora.setMinutes(dentroDeUnaHora.getMinutes() - dentroDeUnaHora.getTimezoneOffset());
  return dentroDeUnaHora.toISOString().slice(0, 16);
}

export default function NuevaPropuestaPage() {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaApertura, setFechaApertura] = useState(fechaLocalPorDefecto());
  const [duracionDias, setDuracionDias] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Vías habilitadas en el servidor; hasta saberlas, solo certificado.
  const [vias, setVias] = useState<ViaVoto[]>(["certificado"]);
  const [via, setVia] = useState<ViaPropuesta>("certificado");

  useEffect(() => {
    let cancelado = false;
    fetch("/api/propuestas", { cache: "no-store" })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((cuerpo) => {
        if (cancelado || !cuerpo || !Array.isArray(cuerpo.viasHabilitadas)) return;
        const habilitadas = VIAS.filter((v) => cuerpo.viasHabilitadas.includes(v));
        if (habilitadas.length === 0) return;
        setVias(habilitadas);
        // Con las dos habilitadas, por defecto elige el votante (ADR 0022).
        setVia(habilitadas.length > 1 ? "ambas" : habilitadas[0]);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!titulo.trim() || !pregunta.trim()) {
      setError("El título y la pregunta son obligatorios.");
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch("/api/propuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          pregunta: pregunta.trim(),
          descripcion: descripcion.trim(),
          fechaApertura: new Date(fechaApertura).toISOString(),
          duracionDias,
          via,
        }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se ha podido crear la propuesta.");
        return;
      }
      router.push(`/propuestas`);
    } catch {
      setError("No se ha podido contactar con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Nueva propuesta</h1>
        <p>
          Se crea en el contrato público (paga el gas el relayer de esta
          instancia) y queda abierta a votación en la fecha que elijas.
        </p>
      </div>

      <form className="panel" onSubmit={enviar}>
        <div className="form-field">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Presupuestos participativos 2027"
          />
        </div>

        <div className="form-field">
          <label htmlFor="pregunta">¿Qué se quiere votar?</label>
          <input
            id="pregunta"
            type="text"
            value={pregunta}
            onChange={(evento) => setPregunta(evento.target.value)}
            placeholder="¿Apruebas la propuesta de presupuestos participativos 2027?"
          />
        </div>

        <div className="form-field">
          <label htmlFor="descripcion">Descripción (opcional)</label>
          <input
            id="descripcion"
            type="text"
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            placeholder="Contexto breve de la propuesta"
          />
        </div>

        <div className="form-field">
          <label htmlFor="fecha-apertura">Fecha de apertura</label>
          <input
            id="fecha-apertura"
            type="datetime-local"
            value={fechaApertura}
            onChange={(evento) => setFechaApertura(evento.target.value)}
          />
          <p className="form-hint">Desde este instante se podrá votar.</p>
        </div>

        <div className="form-field">
          <label htmlFor="duracion">Días abierta</label>
          <input
            id="duracion"
            type="number"
            min={1}
            max={365}
            value={duracionDias}
            onChange={(evento) => setDuracionDias(Number(evento.target.value))}
          />
          <p className="form-hint">
            Cierra automáticamente {duracionDias} días después de la apertura.
          </p>
        </div>

        {vias.length > 1 ? (
          <fieldset className="opciones-fieldset form-field">
            <legend className="opciones-legend">Cómo se identificarán los votantes</legend>
            <label className="form-check">
              <input
                type="radio"
                name="via"
                value="ambas"
                checked={via === "ambas"}
                onChange={() => setVia("ambas")}
              />
              <span>
                <strong>El votante elige</strong>: certificado digital o DNIe/pasaporte con ZKPassport. Atención:
                una persona podría votar una vez con cada forma, y no se detecta.
              </span>
            </label>
            <label className="form-check">
              <input
                type="radio"
                name="via"
                value="certificado"
                checked={via === "certificado"}
                onChange={() => setVia("certificado")}
              />
              <span>
                <strong>Certificado digital</strong> (recomendado). El DNIe y el certificado de la FNMT dan el
                mismo resultado: cada persona vota una sola vez.
              </span>
            </label>
            <label className="form-check">
              <input type="radio" name="via" value="zk" checked={via === "zk"} onChange={() => setVia("zk")} />
              <span>
                <strong>DNIe o pasaporte con ZKPassport</strong>. La web no conoce la identidad, pero quien tenga
                DNIe y pasaporte podría votar dos veces.
              </span>
            </label>
            <p className="form-hint">
              Con una sola forma, nadie puede votar dos veces. La elección queda fijada en el contrato y no se puede
              cambiar.
            </p>
          </fieldset>
        ) : (
          <p className="form-hint">
            {via === "zk"
              ? "Los votantes se identificarán con su DNIe o pasaporte (ZKPassport). Es la única forma habilitada en esta instancia."
              : "Los votantes se identificarán con su certificado digital. Es la única forma habilitada en esta instancia."}
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={enviando}>
          {enviando ? "Creando…" : "Crear propuesta"}
        </button>
      </form>
    </main>
  );
}
