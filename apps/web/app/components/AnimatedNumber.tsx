"use client";

import { useEffect, useRef } from "react";

/**
 * Cuenta desde 0 hasta `value` al montarse, respetando
 * prefers-reduced-motion. Usado en el panel de resultados de ejemplo de la
 * landing; el panel real leerá los números directamente del contrato.
 */
export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      el.textContent = value.toLocaleString("es-ES");
      return;
    }

    const duration = 900;
    let start: number | null = null;
    let frame: number;

    function step(ts: number) {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (el) el.textContent = Math.round(value * eased).toLocaleString("es-ES");
      if (progress < 1) frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div className="ledger-num" ref={ref}>
      0
    </div>
  );
}
