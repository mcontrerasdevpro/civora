"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { OpcionVoto } from "@civora/shared-types";

/**
 * Verificador público: el votante introduce su recibo (nullifier) y
 * comprueba que su voto está contado. El nullifier no revela su identidad;
 * la opción sí es pública, igual que en el registro on-chain.
 */

const ETIQUETAS_OPCION: Record<OpcionVoto, string> = {
  a_favor: "A favor",
  en_contra: "En contra",
  abstencion: "Abstención",
};

type Resultado =
  | { estado: "idle" }
  | { estado: "buscando" }
  | { estado: "no_encontrado" }
  | { estado: "encontrado"; opcion: OpcionVoto; timestamp: number }
  | { estado: "error" };

function FormularioVerificacion() {
  const parametros = useSearchParams();
  const [propuestaId, setPropuestaId] = useState(parametros.get("propuestaId") ?? "");
  const [nullifier, setNullifier] = useState(parametros.get("nullifier") ?? "");
  const [resultado, setResultado] = useState<Resultado>({ estado: "idle" });

  async function verificar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nullifier.trim() || !propuestaId.trim()) return;
    setResultado({ estado: "buscando" });
    try {
      const respuesta = await fetch(
        `/api/propuesta/votos/${encodeURIComponent(nullifier.trim())}` +
          `?propuestaId=${encodeURIComponent(propuestaId.trim())}`,
        { cache: "no-store" }
      );
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        setResultado({ estado: "error" });
        return;
      }
      setResultado(
        cuerpo.encontrado
          ? { estado: "encontrado", opcion: cuerpo.opcion, timestamp: cuerpo.timestamp }
          : { estado: "no_encontrado" }
      );
    } catch {
      setResultado({ estado: "error" });
    }
  }

  return (
    <form className="panel" onSubmit={verificar}>
      <div className="form-field">
        <label htmlFor="propuestaId">Propuesta</label>
        <input
          id="propuestaId"
          type="text"
          value={propuestaId}
          onChange={(evento) => setPropuestaId(evento.target.value)}
          placeholder="Id de la propuesta (lo trae el enlace del recibo)"
          autoComplete="off"
        />
      </div>
      <div className="form-field">
        <label htmlFor="nullifier">Recibo (nullifier)</label>
        <input
          id="nullifier"
          type="text"
          value={nullifier}
          onChange={(evento) => setNullifier(evento.target.value)}
          placeholder="Pega aquí el recibo que recibiste al votar"
          autoComplete="off"
        />
      </div>
      <button className="btn-primary" type="submit" disabled={resultado.estado === "buscando"}>
        {resultado.estado === "buscando" ? "Buscando…" : "Comprobar"}
      </button>

      {resultado.estado === "encontrado" && (
        <div className="alert alert-ok" style={{ marginTop: 20, marginBottom: 0 }}>
          Tu voto está contado: <strong>{ETIQUETAS_OPCION[resultado.opcion]}</strong>, registrado
          el {new Date(resultado.timestamp).toLocaleString("es-ES")}.
        </div>
      )}
      {resultado.estado === "no_encontrado" && (
        <div className="alert alert-error" style={{ marginTop: 20, marginBottom: 0 }}>
          No se ha encontrado ningún voto con ese recibo.
        </div>
      )}
      {resultado.estado === "error" && (
        <div className="alert alert-error" style={{ marginTop: 20, marginBottom: 0 }}>
          No se ha podido comprobar el recibo. Inténtalo de nuevo.
        </div>
      )}
    </form>
  );
}

export default function VerificarPage() {
  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Verificar mi voto</h1>
        <p>
          Introduce el recibo que recibiste al votar para comprobar que tu
          voto se ha contado correctamente, sin revelar quién eres.
        </p>
      </div>
      <Suspense fallback={null}>
        <FormularioVerificacion />
      </Suspense>
    </main>
  );
}
