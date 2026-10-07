"use client";

import { useEffect, useRef, useState } from "react";
import type { OpcionVoto } from "@civora/shared-types";
import { AUDIO_AVISO_AUTOFIRMA, AUDIO_CONFIRMACION, elegirVozLocal } from "../../lib/modo-sencillo.mjs";

/** Tiempo máximo de espera a que el navegador publique sus voces. */
const ESPERA_VOCES_MS = 1500;

type EstadoVoz = { tipo: "comprobando" } | { tipo: "sin-voz" } | { tipo: "lista"; voz: SpeechSynthesisVoice };

/**
 * Lee un texto en voz alta con speechSynthesis, solo con voces del propio
 * dispositivo: las voces en red envían el texto fuera. Si no hay ninguna
 * local, el botón se oculta con un aviso. Nunca debe recibir la opción
 * elegida: para eso está AudioConfirmacion.
 */
export function BotonEscuchar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<EstadoVoz>({ tipo: "comprobando" });
  const [hablando, setHablando] = useState(false);

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
  }, [texto]);

  if (estado.tipo === "comprobando") return null;

  if (estado.tipo === "sin-voz") {
    return (
      <p className="aviso-escuchar" role="note">
        La lectura en voz alta no está disponible en este navegador.
      </p>
    );
  }

  function alternar() {
    if (estado.tipo !== "lista") return;
    const sintesis = window.speechSynthesis;
    sintesis.cancel();
    if (hablando) {
      setHablando(false);
      return;
    }
    const enunciado = new SpeechSynthesisUtterance(texto);
    enunciado.voice = estado.voz;
    enunciado.lang = estado.voz.lang;
    enunciado.rate = 0.9;
    enunciado.onend = () => setHablando(false);
    enunciado.onerror = () => setHablando(false);
    setHablando(true);
    sintesis.speak(enunciado);
  }

  return (
    <button type="button" className="btn-escuchar" onClick={alternar} aria-pressed={hablando}>
      <span aria-hidden="true">🔊</span> {hablando ? "Parar" : "Escuchar"}
    </button>
  );
}

/**
 * Lee la confirmación de la opción elegida con un audio pregrabado de
 * nuestro propio origen (media-src 'self'), sin speechSynthesis. En la vía
 * de certificado, a continuación suena el aviso de que se abrirá Autofirma.
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
  const [error, setError] = useState(false);

  function reproducir() {
    const elemento = audioOpcion.current;
    if (!elemento) return;
    audioAviso.current?.pause();
    elemento.currentTime = 0;
    elemento.play().catch(() => setError(true));
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
      {error ? (
        <p className="aviso-escuchar" role="note">
          No se ha podido reproducir el audio.
        </p>
      ) : (
        <button type="button" className="btn-escuchar" onClick={reproducir}>
          <span aria-hidden="true">🔊</span> Escuchar
        </button>
      )}
    </>
  );
}
