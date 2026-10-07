"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { guardarModoSencillo, leerModoSencillo } from "../../lib/modo-sencillo.mjs";

type ContextoModoSencillo = {
  sencillo: boolean;
  cambiar: (activo: boolean) => void;
};

const Contexto = createContext<ContextoModoSencillo>({ sencillo: false, cambiar: () => {} });

export function useModoSencillo(): ContextoModoSencillo {
  return useContext(Contexto);
}

function almacen(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * Mantiene el modo sencillo para todas las páginas de /votar. La preferencia
 * se lee tras montar (no en el render) para no romper la hidratación y sin
 * scripts inline, de modo que la CSP con nonce no cambia.
 */
export function ProveedorModoSencillo({ children }: { children: ReactNode }) {
  const [sencillo, setSencillo] = useState(false);

  useEffect(() => {
    setSencillo(leerModoSencillo(almacen));
  }, []);

  function cambiar(activo: boolean) {
    setSencillo(activo);
    guardarModoSencillo(almacen, activo);
  }

  return (
    <Contexto.Provider value={{ sencillo, cambiar }}>
      <div className={sencillo ? "flujo-voto modo-sencillo" : "flujo-voto"}>{children}</div>
    </Contexto.Provider>
  );
}

export function InterruptorModoSencillo() {
  const { sencillo, cambiar } = useModoSencillo();

  return (
    <div className="interruptor-sencillo">
      <button
        type="button"
        role="switch"
        aria-checked={sencillo}
        aria-describedby="modo-sencillo-desc"
        className="interruptor-boton"
        onClick={() => cambiar(!sencillo)}
      >
        <span className="interruptor-pista" aria-hidden="true">
          <span className="interruptor-bola" />
        </span>
        Modo sencillo
      </button>
      <span id="modo-sencillo-desc" className="interruptor-desc">
        Letra más grande, un paso cada vez y sin palabras técnicas.
      </span>
    </div>
  );
}

/** Avisos fijos visibles en todas las pantallas de votación. */
export function AvisosVoto() {
  return (
    <aside className="avisos-voto" aria-label="Avisos importantes">
      <p className="aviso-secreto">
        <strong>Nadie puede pedirle ver su voto.</strong> Su voto es secreto, también para
        las personas que le ayuden.
      </p>
      <details className="aviso-ayuda">
        <summary>¿Necesita ayuda?</summary>
        <p>
          Puede pedir a una persona de confianza que le ayude a identificarse. Cuando llegue
          el momento de elegir, hágalo a solas. El servicio de ayuda nunca le preguntará qué
          vota.
        </p>
      </details>
    </aside>
  );
}
