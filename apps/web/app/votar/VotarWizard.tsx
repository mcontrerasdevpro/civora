"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { OpcionVoto, Propuesta } from "@civora/shared-types";
import { MetodoSelector, type MetodoIdentificacion } from "./MetodoSelector";
import { IdentificacionDnie, PruebaZk } from "./IdentificacionDnie";
import { IdentificacionCertificado, type DatosCertificado } from "./IdentificacionCertificado";
import type { Identificacion } from "./identificacion";
import { useModoSencillo } from "./ModoSencillo";
import type { SolidityVerifierParameters } from "@civora/zk-identity";
import { AudioConfirmacion, BotonEscuchar } from "./Escuchar";
import { ErrorAutofirma, firmarReto } from "./autofirma";
import { Justificante } from "./Justificante";
import { esRetoCaducado, mensajeParaVotante } from "../../lib/modo-sencillo.mjs";

/**
 * Flujo de voto, en 4 pasos, para una propuesta concreta:
 *  1. Identificación -> el votante elige DNIe/pasaporte (ZKPassport, prueba
 *     verificada dentro del contrato al votar) o certificado digital
 *     (Autofirma, firma verificada en el servidor).
 *  2. Elección de la opción.
 *  3. Confirmación explícita antes de enviar. Al pulsar «Sí» se genera la
 *     prueba de identidad con la opción incluida, para que no sirva para otra:
 *     en la vía ZK, un QR para la app ZKPassport, que vincula la opción a la
 *     prueba (R-01); en la vía de certificado, un reto con la opción que
 *     Autofirma firma (R-04). El contrato (ZK) o el servidor (certificado)
 *     verifican la prueba y la convierten en nullifier; el voto nunca viaja
 *     con la identidad.
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
  const [enviando, setEnviando] = useState<false | "firmando" | "enviando">(false);
  // Vía ZK: el QR de ZKPassport se muestra en la confirmación tras pulsar «Sí».
  const [pruebaZkEnCurso, setPruebaZkEnCurso] = useState(false);
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
  const fechaCierreLegible = new Date(propuesta.fechaCierre).toLocaleString("es-ES");

  function identificacionCompletada(valor: Identificacion) {
    setError(null);
    setRetoCaducado(false);
    setIdentificacion(valor);
    setPaso("voto");
  }

  function irAConfirmacion(evento: React.FormEvent) {
    evento.preventDefault();
    if (!opcion) return;
    setError(null);
    setPaso("confirmacion");
  }

  async function votarConCertificado(opcionElegida: OpcionVoto): Promise<Response | null> {
    setEnviando("firmando");
    const respuestaReto = await fetch("/api/identidad/certificado/reto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propuestaId: propuesta.id, opcion: opcionElegida }),
    });
    if (!respuestaReto.ok) {
      setError(sencillo ? ERROR_GENERICO : "No se ha podido preparar la firma del voto.");
      return null;
    }
    const { reto, timestamp } = (await respuestaReto.json()) as { reto: string; timestamp: number };

    let firma: { firmaB64: string; certB64: string };
    try {
      firma = await firmarReto(reto);
    } catch (errorFirma) {
      const mensaje = errorFirma instanceof ErrorAutofirma ? errorFirma.message : "No se ha podido firmar con Autofirma.";
      setError(
        sencillo
          ? "No se ha podido firmar con Autofirma. Compruebe que el programa está abierto e inténtelo de nuevo."
          : mensaje
      );
      return null;
    }

    setEnviando("enviando");
    // La firma y el certificado solo viajan en esta petición; el servidor
    // los descarta tras verificarlos.
    return fetch("/api/propuesta/votos/certificado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propuestaId: propuesta.id,
        opcion: opcionElegida,
        timestamp,
        reto,
        signatureB64: firma.firmaB64,
        certB64: firma.certB64,
      }),
    });
  }

  function votarConPruebaZk(opcionElegida: OpcionVoto, parametrosVerificacion: SolidityVerifierParameters) {
    setEnviando("enviando");
    return fetch("/api/propuesta/votos/zk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propuestaId: propuesta.id, opcion: opcionElegida, parametrosVerificacion }),
    });
  }

  function confirmar() {
    if (!opcion || !identificacion) return;
    setError(null);
    if (identificacion.tipo === "zk") {
      setPruebaZkEnCurso(true);
      return;
    }
    void votar();
  }

  async function votar(parametrosVerificacion?: SolidityVerifierParameters) {
    if (!opcion || !identificacion) return;
    setError(null);
    try {
      let respuesta: Response | null;
      if (identificacion.tipo === "zk") {
        if (!parametrosVerificacion) return;
        respuesta = await votarConPruebaZk(opcion, parametrosVerificacion);
      } else {
        respuesta = await votarConCertificado(opcion);
        if (!respuesta) return;
      }
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        if (identificacion.tipo === "certificado" && esRetoCaducado(cuerpo.error)) {
          // El servidor da un tiempo limitado para firmar. Se queda en la
          // confirmación, con la opción elegida, para firmar de nuevo.
          setRetoCaducado(true);
          return;
        }
        setError(mensajeParaVotante(cuerpo.error ?? ERROR_GENERICO, sencillo, ERROR_GENERICO));
        return;
      }
      setRetoCaducado(false);
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
      setPruebaZkEnCurso(false);
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
    recibo: "Su voto se ha guardado. Guarde el código de recibo: podrá comprobar su voto cuando termine la votación.",
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

      {paso === "identificacion" && !metodo && <MetodoSelector onElegir={setMetodo} />}

      {paso === "identificacion" && metodo === "dnie" && (
        <IdentificacionDnie
          onVerificado={identificacionCompletada}
          onCambiarMetodo={() => setMetodo(null)}
        />
      )}

      {paso === "identificacion" && metodo === "certificado" && (
        <IdentificacionCertificado
          propuesta={propuesta}
          datos={datosCertificado}
          onCambiarDatos={setDatosCertificado}
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
          {identificacion?.tipo === "certificado" && (
            <p className="aviso-autofirma" id="aviso-autofirma">
              {sencillo
                ? "Al pulsar «Sí» se abrirá Autofirma para que firme su voto con su certificado."
                : "Al pulsar «Sí» se abrirá Autofirma para que firmes tu voto con tu certificado digital."}
            </p>
          )}
          {identificacion?.tipo === "zk" && (
            <p className="aviso-autofirma" id="aviso-zk">
              {sencillo
                ? "Al pulsar «Sí» aparecerá un código. Léalo con la app ZKPassport de su móvil para confirmar su voto con su DNI o pasaporte."
                : "Al pulsar «Sí» aparecerá un código QR. Escanéalo con la app ZKPassport para votar con tu DNIe o pasaporte."}
            </p>
          )}
          <AudioConfirmacion opcion={opcion} conAvisoAutofirma={identificacion?.tipo === "certificado"} />
          {retoCaducado && (
            <div className="alert alert-info" role="alert">
              {sencillo
                ? "Ha pasado demasiado tiempo y, por seguridad, tiene que firmar otra vez. No ha perdido nada: su opción sigue aquí. Pulse «Firmar de nuevo»."
                : "La firma ha caducado: el servidor solo la acepta durante unos minutos. Tu elección se conserva; pulsa «Firmar de nuevo» para continuar."}
            </div>
          )}
          {pruebaZkEnCurso ? (
            <PruebaZk
              propuesta={propuesta}
              opcion={opcion}
              onPrueba={(parametrosVerificacion) => void votar(parametrosVerificacion)}
              onCancelar={() => setPruebaZkEnCurso(false)}
            />
          ) : (
            <div className="confirmacion-botones" role="group" aria-labelledby="texto-confirmacion">
              <button
                className="btn-primary"
                type="button"
                onClick={confirmar}
                disabled={Boolean(enviando)}
                aria-describedby={
                  identificacion?.tipo === "certificado" ? "aviso-autofirma" : identificacion?.tipo === "zk" ? "aviso-zk" : undefined
                }
              >
                {enviando === "firmando"
                  ? "Esperando a Autofirma…"
                  : enviando === "enviando"
                    ? "Enviando…"
                    : retoCaducado
                      ? "Firmar de nuevo"
                      : "Sí"}
              </button>
              <button
                className="btn-secundario"
                type="button"
                onClick={() => {
                  setRetoCaducado(false);
                  setPaso("voto");
                }}
                disabled={Boolean(enviando)}
              >
                Volver
              </button>
            </div>
          )}
          <div aria-live="polite">
            {enviando === "firmando" && (
              <div className="alert alert-info" style={{ marginTop: 20, marginBottom: 0 }}>
                {sencillo
                  ? "Firme su voto en la ventana de Autofirma."
                  : "Firma tu voto en la ventana de Autofirma."}
              </div>
            )}
            {enviando === "enviando" && (
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
          {/* La API solo responde a los recibos tras el cierre (423 antes). */}
          <p className="form-hint">
            {sencillo
              ? `Podrá comprobarlo cuando termine la votación, el ${fechaCierreLegible}.`
              : `Podrás verificarlo cuando cierre la votación, el ${fechaCierreLegible}.`}
          </p>
          {/* Sin precarga: Next pediría /verificar?nullifier=… al servidor nada más
              mostrar el recibo, y el recibo quedaría en los registros del proxy. */}
          <Link
            className="link-quiet"
            prefetch={false}
            href={`/verificar?propuestaId=${propuesta.id}&nullifier=${nullifier}`}
          >
            {sencillo ? "Enlace para comprobar mi voto" : "Enlace para verificar mi voto"}
          </Link>
          {/* Solo los datos públicos de la propuesta: nunca la opción ni el recibo. */}
          <Justificante
            propuesta={{
              titulo: propuesta.titulo,
              fechaApertura: propuesta.fechaApertura,
              fechaCierre: propuesta.fechaCierre,
            }}
            sencillo={sencillo}
          />
        </div>
      )}
    </>
  );
}
