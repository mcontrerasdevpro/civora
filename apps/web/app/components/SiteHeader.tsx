import Link from "next/link";
import { LogoMark } from "./LogoMark";

export function SiteHeader() {
  return (
    <header className="site">
      <div className="wrap site-bar">
        <Link className="brand" href="/">
          <LogoMark size={32} />
          <span className="brand-text">
            <span className="brand-name">CÍVORA</span>
            <span className="brand-tagline">Infraestructura de votación verificable</span>
          </span>
        </Link>
        <nav className="site-nav">
          <Link href="/">Inicio</Link>
          <Link href="/#como-funciona">Cómo funciona</Link>
          <Link href="/#seguridad">Seguridad</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
        <Link className="btn-primary btn-small" href="/propuestas">
          Probar demo →
        </Link>
      </div>
    </header>
  );
}
