"use client";

import { useEffect, useState } from "react";
import type { Propuesta, ResultadoPropuesta } from "@civora/shared-types";
import { AnimatedNumber } from "../../components/AnimatedNumber";

/**
 * Panel público de resultados de una propuesta concreta: nº de registrados,
 * votos a favor, en contra y abstenciones, leídos directamente del
 * contrato VotacionAnonima.
 */
const INTERVALO_REFRESCO_MS = 4000;

export default function ResultadosPropuestaPage({ params }: { params: { id: string } }) {
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [resultados, setResultados] = useState<ResultadoPropuesta | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const respuesta = await fetch(`/api/propuestas/${params.id}`, { cache: "no-store" });
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        if (!cancelado) {
          setPropuesta(cuerpo.propuesta);
          setResultados(cuerpo.resultados);
          setError(false);
        }
      } catch {
        if (!cancelado) setError(true);
      }
    }

    cargar();
    const id = setInterval(cargar, INTERVALO_REFRESCO_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [params.id]);

  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Resultados</h1>
        <p>{propuesta?.titulo ?? "Cargando…"}</p>
      </div>

      {error && (
        <div className="alert alert-error">
          No se han podido cargar los resultados. Reintentando…
        </div>
      )}

      <div className="ledger-frame">
        <div className="ledger-top">
          <span className="ledger-top-label">{propuesta?.pregunta ?? ""}</span>
          <span className="ledger-top-badge">en directo</span>
        </div>
        <div className="ledger-grid">
          <div className="ledger-cell">
            <AnimatedNumber value={resultados?.registrados ?? 0} />
            <div className="ledger-cell-label">Registrados</div>
          </div>
          <div className="ledger-cell favor">
            <AnimatedNumber value={resultados?.aFavor ?? 0} />
            <div className="ledger-cell-label">A favor</div>
          </div>
          <div className="ledger-cell contra">
            <AnimatedNumber value={resultados?.enContra ?? 0} />
            <div className="ledger-cell-label">En contra</div>
          </div>
          <div className="ledger-cell">
            <AnimatedNumber value={resultados?.abstenciones ?? 0} />
            <div className="ledger-cell-label">Abstenciones</div>
          </div>
        </div>
        <div className="ledger-foot">Datos leídos directamente del contrato público.</div>
      </div>
    </main>
  );
}
