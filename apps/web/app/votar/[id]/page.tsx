"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Propuesta } from "@civora/shared-types";
import { VotarWizard } from "../VotarWizard";
import { viasHabilitadas, type ViaVoto } from "../../../lib/vias-voto.mjs";

type Estado =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "archivada"; mensaje: string }
  | { fase: "lista"; propuesta: Propuesta; vias: ViaVoto[] };

export default function VotarPropuestaPage() {
  // useParams funciona igual en Next 14 y 15 (en 15 la prop `params` es una promesa).
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/propuestas/${id}`, { cache: "no-store" })
      .then(async (respuesta) => {
        // 410: la propuesta es de un contrato anterior y ya no admite votos.
        if (respuesta.status === 410) {
          const cuerpo = await respuesta.json();
          if (!cancelado) setEstado({ fase: "archivada", mensaje: cuerpo.error });
          return;
        }
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        // Sin la lista (servidor anterior), solo certificado: nunca se abre
        // una vía que el servidor no haya declarado.
        const vias = viasHabilitadas(Array.isArray(cuerpo.viasPermitidas) ? cuerpo.viasPermitidas.join(",") : undefined);
        if (!cancelado) setEstado({ fase: "lista", propuesta: cuerpo.propuesta, vias });
      })
      .catch(() => {
        if (!cancelado) setEstado({ fase: "error" });
      });

    return () => {
      cancelado = true;
    };
  }, [id]);

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
          No se ha podido cargar esta propuesta. Comprueba el enlace o
          consulta{" "}
          <a className="link-quiet" href="/propuestas">
            el listado de propuestas
          </a>
          .
        </div>
      )}

      {estado.fase === "archivada" && (
        <div className="alert alert-info" role="status">
          {estado.mensaje} Consulta{" "}
          <a className="link-quiet" href="/propuestas">
            las propuestas abiertas
          </a>
          .
        </div>
      )}

      {estado.fase === "lista" && <VotarWizard propuesta={estado.propuesta} vias={estado.vias} />}
    </main>
  );
}
