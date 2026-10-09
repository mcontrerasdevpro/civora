"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import type { Propuesta } from "@civora/shared-types";
import { datosJustificante, generarPdfJustificante, type DatosJustificante } from "../../lib/justificante.mjs";

/**
 * Justificante de participación, opcional. Solo se crea si la persona lo
 * pide; no hace falta para que el voto cuente. Se genera en el navegador,
 * sin enviar nada al servidor, y no contiene la opción, el recibo, la
 * transacción ni la hora del voto (lib/justificante.mjs).
 *
 * Solo recibe los datos públicos de la propuesta: este componente no tiene
 * acceso a la opción elegida.
 */
type Props = {
  propuesta: Pick<Propuesta, "titulo" | "fechaApertura" | "fechaCierre">;
  sencillo: boolean;
};

function Contenido({ datos, idTitulo, titulo }: { datos: DatosJustificante; idTitulo?: string; titulo?: Ref<HTMLHeadingElement> }) {
  return (
    <>
      <h2 id={idTitulo} ref={titulo} tabIndex={titulo ? -1 : undefined}>
        {datos.titulo}
      </h2>
      <p className="justificante-aviso">{datos.aviso}</p>
      <dl>
        <dt>Propuesta</dt>
        <dd>{datos.propuesta}</dd>
        <dt>Periodo de votación</dt>
        <dd>{datos.periodo}</dd>
      </dl>
      <p className="justificante-secreto">{datos.secreto}</p>
      <p>{datos.garantia}</p>
      <p>{datos.nadie}</p>
    </>
  );
}

export function Justificante({ propuesta, sencillo }: Props) {
  const [abierto, setAbierto] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (abierto) titulo.current?.focus();
  }, [abierto]);

  if (!abierto) {
    return (
      <p className="justificante-oferta">
        <button type="button" className="btn-discreto" onClick={() => setAbierto(true)}>
          Obtener justificante
        </button>
        <span className="form-hint">
          {sencillo
            ? " Es opcional: un papel que dice que ha votado, sin decir qué."
            : " Opcional: acredita que has participado, sin indicar qué votaste."}
        </span>
      </p>
    );
  }

  const datos = datosJustificante(propuesta);

  function descargarPdf() {
    const pdf = generarPdfJustificante(datos);
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    // Sin fecha en el nombre: la hora del voto no debe quedar en ningún sitio.
    enlace.download = "justificante-participacion-civora.pdf";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
  }

  return (
    <section className="justificante-zona" aria-labelledby="justificante-titulo">
      <article className="justificante">
        <Contenido datos={datos} idTitulo="justificante-titulo" titulo={titulo} />
      </article>
      {/* Copia solo para imprimir, colgada de <body>: al imprimir se oculta
          todo lo demás con display: none (ni recibo ni hojas en blanco). En
          pantalla no se muestra. */}
      {createPortal(
        <article className="justificante-impresion">
          <Contenido datos={datos} />
        </article>,
        document.body
      )}
      <div className="justificante-acciones">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          Imprimir
        </button>
        <button type="button" className="btn-secundario" onClick={descargarPdf}>
          Descargar PDF
        </button>
        <button type="button" className="btn-discreto" onClick={() => setAbierto(false)}>
          {sencillo ? "Cerrar" : "Cerrar justificante"}
        </button>
      </div>
      <p className="form-hint">
        {sencillo
          ? "Se prepara en su dispositivo: no se envía a ningún sitio."
          : "Se genera en tu navegador: no se envía nada al servidor."}
      </p>
    </section>
  );
}
