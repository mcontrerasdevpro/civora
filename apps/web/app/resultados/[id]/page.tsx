"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Propuesta, ResultadoPropuesta } from "@civora/shared-types";
import { calcularReparto } from "../../../lib/porcentajes-resultados.mjs";
import type { VerificacionResultados } from "../../../lib/verificacion-resultados";
import { useModoSencillo } from "../../votar/ModoSencillo";
import { GraficoResultados } from "./GraficoResultados";
import { VerificaResultado } from "./VerificaResultado";

/**
 * Resultados de una propuesta, leídos del contrato VotacionAnonima. Antes
 * del cierre la API no los devuelve (M-01) y aquí solo se avisa de cuándo
 * se publicarán; después se muestran gráfica, tabla y cómo verificarlos.
 */
const INTERVALO_REFRESCO_MS = 4000;

type Estado =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "archivada"; mensaje: string }
  | { fase: "ocultos"; propuesta: Propuesta }
  | { fase: "no_disponibles"; propuesta: Propuesta }
  | { fase: "lista"; propuesta: Propuesta; resultados: ResultadoPropuesta };

type EstadoVerificacion =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "lista"; verificacion: VerificacionResultados };

function TablaResultados({ resultados }: { resultados: ResultadoPropuesta }) {
  const reparto = calcularReparto(resultados);
  return (
    <>
      <table className="tabla-resultados">
        <caption>Resultados en tabla</caption>
        <thead>
          <tr>
            <th scope="col">Opción</th>
            <th scope="col">Votos</th>
            <th scope="col">Porcentaje de los votos emitidos</th>
          </tr>
        </thead>
        <tbody>
          {reparto.filas.map((fila) => (
            <tr key={fila.opcion}>
              <th scope="row">{fila.etiqueta}</th>
              <td>{fila.votos.toLocaleString("es-ES")}</td>
              <td>{fila.porcentaje ?? "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total de votos emitidos</th>
            <td>{reparto.total.toLocaleString("es-ES")}</td>
            <td>{reparto.sumaTexto ?? "—"}</td>
          </tr>
        </tfoot>
      </table>
      {reparto.notaRedondeo && <p className="form-hint nota-redondeo">{reparto.notaRedondeo}</p>}
    </>
  );
}

function DesglosePorVia({ estado }: { estado: EstadoVerificacion }) {
  if (estado.fase === "cargando") return <p className="form-hint">Calculando los votos por vía…</p>;
  const recuento = estado.fase === "lista" ? estado.verificacion.recuento : null;
  if (!recuento?.disponible || !recuento.porVia) {
    return (
      <p className="form-hint">
        Los votos por vía de identificación no están disponibles ahora desde este servidor. Se pueden contar con los
        pasos de la sección de comprobación, al final de la página.
      </p>
    );
  }
  const { certificado, zk, otra } = recuento.porVia;
  return (
    <table className="tabla-resultados tabla-vias">
      <caption className="sr-only">Votos por vía de identificación</caption>
      <thead>
        <tr>
          <th scope="col">Vía</th>
          <th scope="col">Votos</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Certificado digital</th>
          <td>{certificado.toLocaleString("es-ES")}</td>
        </tr>
        <tr>
          <th scope="row">DNIe o pasaporte (ZKPassport)</th>
          <td>{zk.toLocaleString("es-ES")}</td>
        </tr>
        {otra > 0 && (
          <tr>
            <th scope="row">Otra</th>
            <td>{otra.toLocaleString("es-ES")}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function ResultadosPropuestaPage() {
  // useParams funciona igual en Next 14 y 15 (en 15 la prop `params` es una promesa).
  const { id } = useParams<{ id: string }>();
  const { sencillo } = useModoSencillo();
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [verificacion, setVerificacion] = useState<EstadoVerificacion>({ fase: "cargando" });
  const listos = estado.fase === "lista";

  useEffect(() => {
    let cancelado = false;
    let intervalo: ReturnType<typeof setInterval> | undefined;

    async function cargar() {
      try {
        const respuesta = await fetch(`/api/propuestas/${id}`, { cache: "no-store" });
        // 410: propuesta de un contrato anterior; sus resultados ya no se leen.
        if (respuesta.status === 410) {
          const cuerpo = await respuesta.json();
          if (!cancelado) setEstado({ fase: "archivada", mensaje: cuerpo.error });
          clearInterval(intervalo);
          return;
        }
        if (!respuesta.ok) throw new Error();
        const cuerpo = await respuesta.json();
        if (cancelado) return;
        if (cuerpo.resultados) {
          // Tras el cierre el contrato no admite más votos: no hace falta refrescar.
          clearInterval(intervalo);
          setEstado({ fase: "lista", propuesta: cuerpo.propuesta, resultados: cuerpo.resultados });
        } else {
          setEstado(
            cuerpo.resultadosNoDisponibles
              ? { fase: "no_disponibles", propuesta: cuerpo.propuesta }
              : { fase: "ocultos", propuesta: cuerpo.propuesta }
          );
        }
      } catch {
        if (!cancelado) setEstado((anterior) => (anterior.fase === "lista" ? anterior : { fase: "error" }));
      }
    }

    cargar();
    intervalo = setInterval(cargar, INTERVALO_REFRESCO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [id]);

  // Los datos para verificar solo se piden con los resultados ya publicados.
  useEffect(() => {
    if (!listos) return;
    let cancelado = false;
    fetch(`/api/propuestas/${id}/verificacion`, { cache: "no-store" })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : Promise.reject(new Error())))
      .then((cuerpo: { verificacion: VerificacionResultados }) => {
        if (!cancelado) setVerificacion({ fase: "lista", verificacion: cuerpo.verificacion });
      })
      .catch(() => {
        if (!cancelado) setVerificacion({ fase: "error" });
      });
    return () => {
      cancelado = true;
    };
  }, [id, listos]);

  // Una discrepancia entre el índice de eventos y el contrato nunca se
  // oculta: también se avisa fuera de la sección plegable.
  const discrepancia =
    verificacion.fase === "lista" &&
    verificacion.verificacion.recuento.disponible &&
    !verificacion.verificacion.recuento.coincide;

  return (
    <main className="wrap page-shell resultados">
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

      {estado.fase === "archivada" && (
        <p className="alert alert-info" role="status">
          {estado.mensaje}
        </p>
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
        <>
          <section className="panel-resultados" aria-labelledby="titulo-resultado">
            <h2 id="titulo-resultado" className="pregunta-resultado">
              {estado.propuesta.pregunta}
            </h2>
            <p className="estado-resultado">
              <span className="sello-final">Resultado final</span> Votación cerrada el{" "}
              {new Date(estado.propuesta.fechaCierre).toLocaleString("es-ES")}.
            </p>

            {calcularReparto(estado.resultados).total === 0 ? (
              <p className="alert alert-info">No se emitió ningún voto en esta votación.</p>
            ) : (
              <GraficoResultados reparto={calcularReparto(estado.resultados)} />
            )}

            <TablaResultados resultados={estado.resultados} />

            <h3>Participación</h3>
            <p className="participacion">
              Aún no se puede calcular qué parte de las personas con derecho a voto ha votado: hace falta un censo
              cerrado, previsto en la Fase 1. Por eso solo se muestran votos emitidos.
            </p>

            <h3>Votos por vía de identificación</h3>
            <DesglosePorVia estado={verificacion} />

            <p className="fuente-resultado">
              {sencillo
                ? "Datos leídos del registro público de votos."
                : "Datos leídos directamente del contrato público."}
            </p>
          </section>

          {discrepancia && (
            <p className="alert alert-error" role="alert">
              {sencillo
                ? "Atención: hay una diferencia entre dos copias del recuento de esta votación."
                : "Atención: el recuento rehecho desde los eventos públicos no coincide con el del contrato. Detalle en «Verifica este resultado»."}
            </p>
          )}

          <VerificaResultado estado={verificacion} sencillo={sencillo} />
        </>
      )}
    </main>
  );
}
