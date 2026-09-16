import { LogoMark } from "./LogoMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-row">
        <div className="brand footer-brand">
          <LogoMark size={26} />
          <span className="brand-text">
            <span className="brand-name">CÍVORA</span>
            <span className="brand-tagline">Democracia digital. Confianza real.</span>
          </span>
        </div>
        <div className="footer-links">
          <a href="/#como-funciona">Cómo funciona</a>
          <a href="/#seguridad">Seguridad</a>
          <a
            href="https://github.com/mcontrerasdevpro/civora"
            target="_blank"
            rel="noreferrer"
          >
            Repositorio
          </a>
        </div>
      </div>
      <div className="wrap">
        <p className="footer-legal">
          Prueba de concepto técnica — no un sistema habilitado para elecciones oficiales
          vinculantes en España.
        </p>
      </div>
    </footer>
  );
}
