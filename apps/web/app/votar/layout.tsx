import type { ReactNode } from "react";
import { AvisosVoto, InterruptorModoSencillo, ProveedorModoSencillo } from "./ModoSencillo";

export default function VotarLayout({ children }: { children: ReactNode }) {
  return (
    <ProveedorModoSencillo>
      <div className="wrap barra-voto">
        <InterruptorModoSencillo />
        <AvisosVoto />
      </div>
      {children}
    </ProveedorModoSencillo>
  );
}
