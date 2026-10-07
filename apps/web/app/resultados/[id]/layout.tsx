import type { ReactNode } from "react";
import { InterruptorModoSencillo, ProveedorModoSencillo } from "../../votar/ModoSencillo";

/** Los resultados comparten el modo sencillo (y su preferencia) con /votar. */
export default function ResultadosLayout({ children }: { children: ReactNode }) {
  return (
    <ProveedorModoSencillo>
      <div className="wrap barra-voto">
        <InterruptorModoSencillo />
      </div>
      {children}
    </ProveedorModoSencillo>
  );
}
