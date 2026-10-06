"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { OpcionVoto, Propuesta } from "@civora/shared-types";
import { MetodoSelector, type MetodoIdentificacion } from "./MetodoSelector";
import { IdentificacionDnie } from "./IdentificacionDnie";
import { IdentificacionCertificado, type DatosCertificado } from "./IdentificacionCertificado";
import type { Identificacion } from "./identificacion";
import { useModoSencillo } from "./ModoSencillo";
import { AudioConfirmacion, BotonEscuchar } from "./Escuchar";
import { esRetoCaducado, mensajeParaVotante } from "../../lib/modo-sencillo.mjs";

/**
 * Flujo de voto, en 4 pasos, para una propuesta concreta:
 *  1. Identificación -> el votante elige DNIe/pasaporte (ZKPassport, prueba
 *     verificada dentro del contrato al votar), certificado digital
 *     (Autofirma, firma verificada en el servidor).
 *  2. Elección de la opción.
 *  3. Confirmación explícita antes de enviar. Al enviar, el voto va con el
 *     nullifier (o, en la vía ZK, con la prueba que el contrato verifica y
 *     convierte en nullifier; en la vía de certificado, con la firma que el
 *     servidor verifica y convierte en nullifier), nunca con la identidad.
 *  4. Recibo, para verificar el voto más tarde en /verificar.
 *
 * En modo sencillo cambian los textos (sin jerga técnica) y aparece el botón
 * «Escuchar»; la lógica y las peticiones son las mismas.
 */

const ETIQUETAS_OPCION: Record<OpcionVoto, string> = {
  a_favor: "A favor",
  en_contra: "En contra",
  abstencion: "Abstención",
};

type Paso = "identificacion" | "voto" | "confirmacion" | "recibo";

const PASOS: { id: Paso; normal: string; sencillo: string }[] = [
  { id: "identificacion", normal: "Identificación", sencillo: "Identificarse" },
  { id: "voto", normal: "Voto", sencillo: "Elegir" },
  { id: "confirmacion", normal: "Confirmación", sencillo: "Confirmar" },
  { id: "recibo", normal: "Recibo", sencillo: "Terminado" },
];

const ERROR_GENERICO = "No se ha podido guardar su voto. Inténtelo de nuevo o pida ayuda.";

export function VotarWizard({ propuesta }: { propuesta: Propuesta }) {
  const { sencillo } = useModoSencillo();
  const [paso, setPaso] = useState<Paso>("identificacion");
  const [metodo, setMetodo] = useState<MetodoIdentificacion | null>(null);
  const [datosCertificado, setDatosCertificado] = useState<DatosCertificado>({
    fechaNacimiento: "",
    declaracion: false,
  });
  const [identificacion, setIdentificacion] = useState<Identificacion | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [opcion, setOpcion] = useState<OpcionVoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retoCaducado, setRetoCaducado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const encabezado = useRef<HTMLHeadingElement>(null);
  const primerRender = useRef(true);

  // Al cambiar de paso, el foco va al título del paso para que teclado y
  // lector de pantalla empiecen por el principio de la nueva pantalla.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    encabezado.current?.focus();
  }, [paso, metodo]);

  const ahora = Date.now();
  const noAbierta = ahora < Date.parse(propuesta.fechaApertura);
  const cerrada = ahora >= Date.parse(propuesta.fechaCierre);

  function identificacionCompletada(valor: Identificacion) {
    setError(null);
    setRetoCaducado(false);
    setIdentificacion(valor);
    // Si el votante ya había elegido (reintento tras caducar el reto), se
    // conserva su elección y vuelve directamente a confirmarla.
    setPaso(opcion ? "confirmacion" : "voto");
  }

  function irAConfirmacion(evento: React.FormEvent) {
    evento.preventDefault();
    if (!opcion) return;
    setError(null);
    setPaso("confirmacion");
  }

  async function votar() {
    if (!opcion || !identificacion) return;
    setError(null);
    setEnviando(true);
    try {
      let respuesta: Response;
      if (identificacion.tipo === "zk") {
        respuesta = await fetch("/api/propuesta/votos/zk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propuestaId: propuesta.id,
            opcion,
            parametrosVerificacion: identificacion.parametrosVerificacion,
          }),
        });
      } else {
        respuesta = await fetch("/api/propuesta/votos/certificado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propuestaId: propuesta.id,
            opcion,
            timestamp: identificacion.timestamp,
            reto: identificacion.reto,
            signatureB64: identificacion.signatureB64,
            certB64: identificacion.certB64,
          }),
        });
      }
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        if (identificacion.tipo === "certificado" && esRetoCaducado(cuerpo.error)) {
          // El servidor da un tiempo limitado para firmar. Se vuelve a pedir
          // la firma conservando método, datos del formulario y opción.
          setIdentificacion(null);
          setRetoCaducado(true);
          setPaso("identificacion");
          return;
        }
        setError(mensajeParaVotante(cuerpo.error ?? ERROR_GENERICO, sencillo, ERROR_GENERICO));
        return;
      }
      setNullifier(cuerpo.nullifier);
      setPaso("recibo");
    } catch {
      setError(
        sencillo
          ? "No hay conexión. Compruebe su conexión a internet e inténtelo de nuevo."
          : "No se ha podido contactar con el servidor."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (noAbierta) {
    return (
      <div className="alert alert-error" role="alert">
        Esta votación todavía no ha comenzado. Abre el{" "}
        {new Date(propuesta.fechaApertura).toLocaleString("es-ES")}.
      </div>
    );
  }

  if (cerrada) {
    return (
      <div className="alert alert-error" role="alert">
        Esta votación ya ha cerrado. Puedes consultar{" "}
        <Link className="link-quiet" href={`/resultados/${propuesta.id}`}>
          los resultados
        </Link>
        .
      </div>
    );
  }

  const indicePaso = PASOS.findIndex((p) => p.id === paso);
  const pasoActual = PASOS[indicePaso];
  const opciones = propuesta.opciones.map((valor) => ETIQUETAS_OPCION[valor]).join(". ");

  const textoEscuchar: Record<Paso, string> = {
    identificacion: metodo
      ? "Siga las instrucciones de la pantalla para identificarse."
      : `${propuesta.pregunta}. Primero tiene que identificarse. Elija cómo hacerlo: con su DNI o pasaporte y el móvil, o con su certificado digital.`,
    voto: `${propuesta.pregunta}. Elija una opción: ${opciones}. Después pulse Continuar.`,
    confirmacion: "",
    recibo: "Su voto se ha guardado. Puede guardar el código de recibo para comprobarlo más tarde.",
  };

  return (
    <>
      <ol className="wizard-steps" aria-label="Pasos para votar">
        {PASOS.map((p, indice) => (
          <li
            key={p.id}
            className={indice === indicePaso ? "activo" : indice < indicePaso ? "hecho" : ""}
            aria-current={indice === indicePaso ? "step" : undefined}
          >
            {String(indice + 1).padStart(2, "0")} · {sencillo ? p.sencillo : p.normal}
          </li>
        ))}
      </ol>

      <h2 className="paso-titulo" ref={encabezado} tabIndex={-1}>
        {sencillo ? `Paso ${indicePaso + 1} de ${PASOS.length}: ${pasoActual.sencillo}` : pasoActual.normal}
      </h2>

      {sencillo && paso !== "confirmacion" && <BotonEscuchar texto={textoEscuchar[paso]} />}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {paso === "identificacion" && retoCaducado && (
        <div className="alert alert-info" role="alert">
          {sencillo
            ? "Ha pasado demasiado tiempo y, por seguridad, tiene que firmar otra vez. No ha perdido nada: sus datos y la opción que eligió siguen aquí. Pulse «Firmar de nuevo»."
            : "La firma ha caducado: el servidor solo la acepta durante unos minutos. Tus datos y tu elección se conservan; pulsa «Firmar de nuevo» para continuar."}
        </div>
      )}

      {paso === "identificacion" && !metodo && <MetodoSelector onElegir={setMetodo} />}

      {paso === "identificacion" && metodo === "dnie" && (
        <IdentificacionDnie
          propuesta={propuesta}
          onVerificado={identificacionCompletada}
          onCambiarMetodo={() => setMetodo(null)}
        />
      )}

      {paso === "identificacion" && metodo === "certificado" && (
        <IdentificacionCertificado
          propuesta={propuesta}
          datos={datosCertificado}
          onCambiarDatos={setDatosCertificado}
          reintento={retoCaducado}
          onVerificado={identificacionCompletada}
          onCambiarMetodo={() => setMetodo(null)}
        />
      )}

      {paso === "voto" && (
        <form className="panel" onSubmit={irAConfirmacion}>
          <fieldset className="opciones-fieldset">
            <legend className="opciones-legend">
              {sencillo ? "Elija una opción" : "Elige una opción"}
            </legend>
            <div className="opciones-voto">
              {propuesta.opciones.map((valor) => (
                <label className="opcion-voto" key={valor}>
                  <input
                    type="radio"
                    name="opcion"
                    value={valor}
                    checked={opcion === valor}
                    onChange={() => setOpcion(valor)}
                  />
                  {ETIQUETAS_OPCION[valor]}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn-primary" type="submit" disabled={!opcion}>
            Continuar
          </button>
        </form>
      )}

      {paso === "confirmacion" && opcion && (
        <div className="panel confirmacion-voto">
          <p className="confirmacion-texto" id="texto-confirmacion">
            Va a votar: <strong>{ETIQUETAS_OPCION[opcion]}</strong>. ¿Es correcto?
          </p>
          <AudioConfirmacion opcion={opcion} />
          <div className="confirmacion-botones" role="group" aria-labelledby="texto-confirmacion">
            <button className="btn-primary" type="button" onClick={votar} disabled={enviando}>
              {enviando ? "Enviando…" : "Sí"}
            </button>
            <button
              className="btn-secundario"
              type="button"
              onClick={() => setPaso("voto")}
              disabled={enviando}
            >
              Volver
            </button>
          </div>
          <div aria-live="polite">
            {enviando && (
              <div className="alert alert-info" style={{ marginTop: 20, marginBottom: 0 }}>
                {sencillo
                  ? "Un momento, estamos guardando su voto. No cierre esta ventana."
                  : "Un momento, estamos procesando tu voto. No cierres esta ventana."}
              </div>
            )}
          </div>
        </div>
      )}

      {paso === "recibo" && nullifier && (
        <div className="panel">
          <div className="alert alert-ok" role="status">
            {sencillo ? "Su voto se ha guardado." : "Tu voto ha sido registrado."}
          </div>
          <p>
            {sencillo
              ? "Este es su código de recibo. Sirve para comprobar más tarde que su voto se ha contado:"
              : "Guarda este recibo para verificar tu voto más tarde:"}
          </p>
          <div className="recibo">{nullifier}</div>
          <Link
            className="link-quiet"
            href={`/verificar?propuestaId=${propuesta.id}&nullifier=${nullifier}`}
          >
            {sencillo ? "Comprobar mi voto ahora" : "Verificar mi voto ahora"}
          </Link>
        </div>
      )}
    </>
  );
}
