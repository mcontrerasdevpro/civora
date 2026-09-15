import type { ReactNode } from "react";

export const metadata = {
  title: "Voto Anónimo",
  description: "Prueba de concepto de un sistema de voto anónimo y verificable.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
