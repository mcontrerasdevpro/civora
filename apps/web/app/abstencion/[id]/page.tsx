"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Recibo = {
  id: string;
  fechaDeclaracion: string;
  huella: string;
  declaracion: { titulo: string; pregunta: string; fechaApertura: string; fechaCierre: string; fechaDeclaracion: string };
};

export default function ConsultarAbstencionPage() {
  const { id } = useParams<{ id: string }>();
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/propuesta/abstenciones/${id}`, { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        if (!cancelado) setRecibo(cuerpo.recibo);
      })
      .catch(() => { if (!cancelado) setError(true); });
    return () => { cancelado = true; };
  }, [id]);

  return (
    <main className="wrap page-shell">
      <div className="page-head"><h1>Registro de abstención notificada</h1></div>
      {error && <div className="alert alert-error" role="alert">No existe este registro o no está disponible.</div>}
      {!error && !recibo && <p className="form-hint">Consultando registro…</p>}
      {recibo && (
        <section className="panel">
          <div className="alert alert-info" role="note">
            Este es un recibo de una declaración firmada conservada por Civora. No es un certificado oficial,
            no es un voto y no demuestra que no se haya emitido un voto por otra vía.
          </div>
          <dl>
            <dt>Identificador</dt><dd><code>{recibo.id}</code></dd>
            <dt>Fecha de declaración</dt><dd>{new Date(recibo.fechaDeclaracion).toLocaleString("es-ES")}</dd>
            <dt>Declaración</dt><dd>Manifiesto que no ejerceré mi voto en esta votación.</dd>
            <dt>Propuesta</dt><dd>{recibo.declaracion.titulo}: {recibo.declaracion.pregunta}</dd>
            <dt>Periodo</dt><dd>{new Date(recibo.declaracion.fechaApertura).toLocaleString("es-ES")} — {new Date(recibo.declaracion.fechaCierre).toLocaleString("es-ES")}</dd>
            <dt>Huella del contenido</dt><dd><code>{recibo.huella}</code></dd>
          </dl>
          <p className="form-hint">El documento firmado completo no se conserva en Civora; la huella permite detectar alteraciones del contenido publicado, no prueba por sí sola quién firmó.</p>
        </section>
      )}
    </main>
  );
}
