import type { ReactNode } from "react";
import { IBM_Plex_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata = {
  title: "CÍVORA — Infraestructura de votación verificable",
  description:
    "Votación digital con identidad certificada (DNIe o certificado digital) y pruebas criptográficas: tu identidad acredita que puedes votar, nunca revela qué has votado.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${ibmPlexMono.variable}`}>
        <SiteHeader />
        {process.env.NEXT_PUBLIC_ZKPASSPORT_DEV_MODE === "true" && (
          <div className="demo-banner" role="status">MODO DEMOSTRACIÓN</div>
        )}
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
