"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Propuesta, ResultadoPropuesta } from "@civora/shared-types";
import { AnimatedNumber } from "../../components/AnimatedNumber";

/**
 * Panel público de resultados de una propuesta concreta: nº de registrados,
 * votos a favor, en contra y abstenciones, leídos directamente del
 * contrato VotacionAnonima.
 */
const INTERVALO_REFRESCO_MS = 4000;

type Estado =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "ocultos"; propuesta: Propuesta }
  | { fase: "no_disponibles"; propuesta: Propuesta }
  | { fase: "lista"; propuesta: Propuesta; resultados: ResultadoPropuesta };

export default function ResultadosPropuestaPage() {
  // useParams funciona igual en Next 14 y 15 (en 15 la prop `params` es una promesa).
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const respuesta = await fetch(`/api/propuestas/${id}`, { cache: "no-store" });
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        if (!cancelado) {
          setEstado(
            cuerpo.resultados
              ? { fase: "lista", propuesta: cuerpo.propuesta, resultados: cuerpo.resultados }
              : cuerpo.resultadosNoDisponibles
                ? { fase: "no_disponibles", propuesta: cuerpo.propuesta }
                : { fase: "ocultos", propuesta: cuerpo.propuesta }
          );
        }
      } catch {
        if (!cancelado) setEstado((anterior) => (anterior.fase === "lista" ? anterior : { fase: "error" }));
      }
    }

    cargar();
    const intervalo = setInterval(cargar, INTERVALO_REFRESCO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [id]);

  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Resultados</h1>
        {"propuesta" in estado ? (
          <p>{estado.propuesta.titulo}</p>
        ) : (
          estado.fase === "cargando" && <p>Cargando…</p>
        )}
      </div>

      {estado.fase === "cargando" && <p className="form-hint">Cargando resultados…</p>}

      {estado.fase === "ocultos" && (
        <p className="alert alert-info">
          Los resultados se publicarán cuando cierre la votación, el{" "}
          {new Date(estado.propuesta.fechaCierre).toLocaleString("es-ES")}.
        </p>
      )}

      {estado.fase === "no_disponibles" && (
        <p className="alert alert-error">Los resultados de esta propuesta no están disponibles.</p>
      )}

      {estado.fase === "error" && (
        <div className="alert alert-error">
          No se ha podido cargar esta propuesta. Comprueba el enlace o consulta{" "}
          <a className="link-quiet" href="/propuestas">
            el listado de propuestas
          </a>
          .
        </div>
      )}

      {estado.fase === "lista" && (
        <div className="ledger-frame">
          <div className="ledger-top">
            <span className="ledger-top-label">{estado.propuesta.pregunta}</span>
            <span className="ledger-top-badge">en directo</span>
          </div>
          <div className="ledger-grid">
            <div className="ledger-cell">
              <AnimatedNumber value={estado.resultados.registrados} />
              <div className="ledger-cell-label">Registrados</div>
            </div>
            <div className="ledger-cell favor">
              <AnimatedNumber value={estado.resultados.aFavor} />
              <div className="ledger-cell-label">A favor</div>
            </div>
            <div className="ledger-cell contra">
              <AnimatedNumber value={estado.resultados.enContra} />
              <div className="ledger-cell-label">En contra</div>
            </div>
            <div className="ledger-cell">
              <AnimatedNumber value={estado.resultados.abstenciones} />
              <div className="ledger-cell-label">Abstenciones</div>
            </div>
          </div>
          <div className="ledger-foot">Datos leídos directamente del contrato público.</div>
        </div>
      )}
    </main>
  );
}
