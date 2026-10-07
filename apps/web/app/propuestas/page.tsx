"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Propuesta } from "@civora/shared-types";

type Estado = "cargando" | "lista" | "error";

function estadoPropuesta(propuesta: Propuesta): { etiqueta: string; clase: string } {
  const ahora = Date.now();
  if (ahora < Date.parse(propuesta.fechaApertura)) {
    return { etiqueta: "Próximamente", clase: "propuesta-badge-proxima" };
  }
  if (ahora >= Date.parse(propuesta.fechaCierre)) {
    return { etiqueta: "Cerrada", clase: "propuesta-badge-cerrada" };
  }
  return { etiqueta: "Abierta", clase: "propuesta-badge-abierta" };
}

export default function PropuestasPage() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/propuestas", { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        if (!cancelado) {
          setPropuestas(cuerpo.propuestas);
          setEstado("lista");
        }
      })
      .catch(() => {
        if (!cancelado) setEstado("error");
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Propuestas</h1>
        <p>Elige una propuesta para votarla o consultar sus resultados.</p>
      </div>

      <Link className="btn-primary" href="/propuestas/nueva" style={{ marginBottom: 32, display: "inline-block" }}>
        + Nueva propuesta
      </Link>

      {estado === "cargando" && <p className="form-hint">Cargando propuestas…</p>}

      {estado === "error" && (
        <div className="alert alert-error">No se han podido cargar las propuestas.</div>
      )}

      {estado === "lista" && propuestas.length === 0 && (
        <p className="form-hint">Todavía no hay ninguna propuesta. Crea la primera.</p>
      )}

      {estado === "lista" && propuestas.length > 0 && (
        <div className="propuestas-lista">
          {propuestas.map((propuesta) => {
            const { etiqueta, clase } = estadoPropuesta(propuesta);
            return (
              <div className="propuesta-card" key={propuesta.id}>
                <div className="propuesta-card-cabecera">
                  <h3>{propuesta.titulo}</h3>
                  <span className={`propuesta-badge ${clase}`}>{etiqueta}</span>
                </div>
                <p className="propuesta-card-pregunta">{propuesta.pregunta}</p>
                <p className="form-hint" style={{ marginTop: 0 }}>
                  Abre el {new Date(propuesta.fechaApertura).toLocaleString("es-ES")} · Cierra el{" "}
                  {new Date(propuesta.fechaCierre).toLocaleString("es-ES")}
                </p>
                <div className="propuesta-card-acciones">
                  <Link className="btn-primary btn-small" href={`/votar/${propuesta.id}`}>
                    Votar
                  </Link>
                  {Date.now() >= Date.parse(propuesta.fechaCierre) ? (
                    <Link className="link-quiet" href={`/resultados/${propuesta.id}`}>
                      Ver resultados
                    </Link>
                  ) : (
                    <span className="form-hint">Resultados al cierre</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
