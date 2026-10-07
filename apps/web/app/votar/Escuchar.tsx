"use client";

import { useEffect, useRef, useState } from "react";
import type { OpcionVoto } from "@civora/shared-types";
import {
  AUDIO_AVISO_AUTOFIRMA,
  AUDIO_AVISO_ESCUCHAS,
  AUDIO_CONFIRMACION,
  AVISO_ESCUCHAS,
  elegirVozLocal,
} from "../../lib/modo-sencillo.mjs";

/** Tiempo máximo de espera a que el navegador publique sus voces. */
const ESPERA_VOCES_MS = 1500;

type EstadoVoz = { tipo: "comprobando" } | { tipo: "sin-voz" } | { tipo: "lista"; voz: SpeechSynthesisVoice };

/**
 * Aviso de escuchas ajenas, por escrito (role="alert") mientras suena el
 * mismo aviso por voz. Lo leído solo suena tras confirmar que se llevan
 * auriculares: el navegador no puede detectarlos, así que se pide confirmarlo.
 */
function ConfirmarAuriculares({ onConfirmar, onCancelar }: { onConfirmar: () => void; onCancelar: () => void }) {
  const confirmar = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmar.current?.focus(), []);

  return (
    <div className="aviso-auriculares" role="alert">
      <p>
        <strong>{AVISO_ESCUCHAS}</strong>
      </p>
      <p>Para escuchar, póngase los auriculares y confírmelo.</p>
      <div className="aviso-auriculares-botones">
        <button ref={confirmar} type="button" className="btn-primary" onClick={onConfirmar}>
          Llevo auriculares puestos
        </button>
        <button type="button" className="btn-secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Lee un texto en voz alta con speechSynthesis, solo con voces del propio
 * dispositivo: las voces en red envían el texto fuera. Si no hay ninguna
 * local, el botón se oculta con un aviso. Nunca debe recibir la opción
 * elegida: para eso está AudioConfirmacion. Antes de leer, avisa de las
 * escuchas ajenas y pide confirmar que se llevan auriculares.
 */
export function BotonEscuchar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<EstadoVoz>({ tipo: "comprobando" });
  const [hablando, setHablando] = useState(false);
  const [pidiendoAuriculares, setPidiendoAuriculares] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setEstado({ tipo: "sin-voz" });
      return;
    }
    const sintesis = window.speechSynthesis;

    function actualizar(definitivo: boolean) {
      const voz = elegirVozLocal(sintesis.getVoices());
      if (voz) setEstado({ tipo: "lista", voz });
      else if (definitivo) setEstado((previo) => (previo.tipo === "lista" ? previo : { tipo: "sin-voz" }));
    }

    const alCambiar = () => actualizar(false);
    actualizar(false);
    sintesis.addEventListener("voiceschanged", alCambiar);
    const espera = window.setTimeout(() => actualizar(true), ESPERA_VOCES_MS);

    return () => {
      window.clearTimeout(espera);
      sintesis.removeEventListener("voiceschanged", alCambiar);
      sintesis.cancel();
    };
  }, []);

  // Al cambiar de pantalla se deja de leer el texto anterior.
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setHablando(false);
    setPidiendoAuriculares(false);
  }, [texto]);

  if (estado.tipo === "comprobando") return null;

  if (estado.tipo === "sin-voz") {
    return (
      <p className="aviso-escuchar" role="note">
        La lectura en voz alta no está disponible en este navegador.
      </p>
    );
  }

  const voz = estado.voz;

  function enunciado(frase: string) {
    const resultado = new SpeechSynthesisUtterance(frase);
    resultado.voice = voz;
    resultado.lang = voz.lang;
    resultado.rate = 0.9;
    return resultado;
  }

  function alternar() {
    const sintesis = window.speechSynthesis;
    sintesis.cancel();
    if (hablando) {
      setHablando(false);
      return;
    }
    // Primero el aviso de escuchas, por voz y por escrito; el texto, después.
    setPidiendoAuriculares(true);
    sintesis.speak(enunciado(AVISO_ESCUCHAS));
  }

  function leer() {
    const sintesis = window.speechSynthesis;
    sintesis.cancel();
    setPidiendoAuriculares(false);
    const lectura = enunciado(texto);
    lectura.onend = () => setHablando(false);
    lectura.onerror = () => setHablando(false);
    setHablando(true);
    sintesis.speak(lectura);
  }

  function cancelar() {
    window.speechSynthesis.cancel();
    setPidiendoAuriculares(false);
  }

  return (
    <>
      <button type="button" className="btn-escuchar" onClick={alternar} aria-pressed={hablando}>
        <span aria-hidden="true">🔊</span> {hablando ? "Parar" : "Escuchar"}
      </button>
      {pidiendoAuriculares && <ConfirmarAuriculares onConfirmar={leer} onCancelar={cancelar} />}
    </>
  );
}

/**
 * Lee la confirmación de la opción elegida con un audio pregrabado de
 * nuestro propio origen (media-src 'self'), sin speechSynthesis. Antes suena
 * el aviso de escuchas ajenas y la opción no se reproduce hasta confirmar
 * que se llevan auriculares. En la vía de certificado, a continuación suena
 * el aviso de que se abrirá Autofirma.
 */
export function AudioConfirmacion({
  opcion,
  conAvisoAutofirma = false,
}: {
  opcion: OpcionVoto;
  conAvisoAutofirma?: boolean;
}) {
  const audioOpcion = useRef<HTMLAudioElement>(null);
  const audioAviso = useRef<HTMLAudioElement>(null);
  const audioEscuchas = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState(false);
  const [pidiendoAuriculares, setPidiendoAuriculares] = useState(false);

  function pararTodo() {
    for (const audio of [audioOpcion, audioAviso, audioEscuchas]) audio.current?.pause();
  }

  function avisar() {
    pararTodo();
    setPidiendoAuriculares(true);
    const aviso = audioEscuchas.current;
    if (!aviso) return;
    aviso.currentTime = 0;
    aviso.play().catch(() => setError(true));
  }

  function reproducir() {
    pararTodo();
    setPidiendoAuriculares(false);
    const elemento = audioOpcion.current;
    if (!elemento) return;
    elemento.currentTime = 0;
    elemento.play().catch(() => setError(true));
  }

  function cancelar() {
    pararTodo();
    setPidiendoAuriculares(false);
  }

  function alTerminarOpcion() {
    const aviso = audioAviso.current;
    if (!conAvisoAutofirma || !aviso) return;
    aviso.currentTime = 0;
    aviso.play().catch(() => setError(true));
  }

  return (
    <>
      <audio
        ref={audioOpcion}
        src={AUDIO_CONFIRMACION[opcion]}
        preload="auto"
        onEnded={alTerminarOpcion}
        onError={() => setError(true)}
      />
      {conAvisoAutofirma && (
        <audio ref={audioAviso} src={AUDIO_AVISO_AUTOFIRMA} preload="auto" onError={() => setError(true)} />
      )}
      <audio ref={audioEscuchas} src={AUDIO_AVISO_ESCUCHAS} preload="auto" onError={() => setError(true)} />
      {error ? (
        <p className="aviso-escuchar" role="note">
          No se ha podido reproducir el audio.
        </p>
      ) : (
        <button type="button" className="btn-escuchar" onClick={avisar}>
          <span aria-hidden="true">🔊</span> Escuchar
        </button>
      )}
      {pidiendoAuriculares && <ConfirmarAuriculares onConfirmar={reproducir} onCancelar={cancelar} />}
    </>
  );
}
