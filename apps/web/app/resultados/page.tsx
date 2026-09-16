"use client";

import { useEffect, useState } from "react";
import type { ResultadoPropuesta } from "@civora/shared-types";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { PROPUESTA_DEMO } from "../../lib/propuesta-demo";

/**
 * Panel público de resultados: nº de registrados, votos a favor, en contra
 * y abstenciones. Lee el registro en memoria de la API (lib/votos-store);
 * en producción se lee directamente del contrato VotacionAnonima.
 */
const INTERVALO_REFRESCO_MS = 4000;

export default function ResultadosPage() {
  const [resultados, setResultados] = useState<ResultadoPropuesta | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const respuesta = await fetch("/api/propuesta", { cache: "no-store" });
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        if (!cancelado) {
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
  }, []);

  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Resultados</h1>
        <p>{PROPUESTA_DEMO.titulo}</p>
      </div>

      {error && (
        <div className="alert alert-error">
          No se han podido cargar los resultados. Reintentando…
        </div>
      )}

      <div className="ledger-frame">
        <div className="ledger-top">
          <span className="ledger-top-label">{PROPUESTA_DEMO.pregunta}</span>
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
        <div className="ledger-foot">
          Datos del registro de esta instancia (en memoria). El panel
          definitivo leerá directamente del contrato público.
        </div>
      </div>
    </main>
  );
}
