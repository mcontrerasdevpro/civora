"use client";

import { useEffect, useState } from "react";
import type { Propuesta } from "@civora/shared-types";
import { VotarWizard } from "../VotarWizard";

type Estado =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "lista"; propuesta: Propuesta };

export default function VotarPropuestaPage({ params }: { params: { id: string } }) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/propuestas/${params.id}`, { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        if (!cancelado) setEstado({ fase: "lista", propuesta: cuerpo.propuesta });
      })
      .catch(() => {
        if (!cancelado) setEstado({ fase: "error" });
      });

    return () => {
      cancelado = true;
    };
  }, [params.id]);

  return (
    <main className="wrap page-shell">
      {estado.fase === "lista" && (
        <div className="page-head">
          <h1>Votar</h1>
          <p>{estado.propuesta.pregunta}</p>
        </div>
      )}

      {estado.fase === "cargando" && <p className="form-hint">Cargando propuesta…</p>}

      {estado.fase === "error" && (
        <div className="alert alert-error">
          No se ha encontrado esta propuesta. Consulta el listado en{" "}
          <a className="link-quiet" href="/propuestas">
            /propuestas
          </a>
          .
        </div>
      )}

      {estado.fase === "lista" && <VotarWizard propuesta={estado.propuesta} />}
    </main>
  );
}
