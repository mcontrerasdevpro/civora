import Image from "next/image";
import Link from "next/link";
import { AnimatedNumber } from "./components/AnimatedNumber";
import { LogoMark } from "./components/LogoMark";

const PASOS = [
  {
    titulo: "Identidad certificada",
    desc: "Te identificas con tu DNIe o certificado digital.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <circle cx="8.5" cy="12" r="2.2" />
        <line x1="13" y1="9.5" x2="18.5" y2="9.5" strokeLinecap="round" />
        <line x1="13" y1="12" x2="18.5" y2="12" strokeLinecap="round" />
        <line x1="13" y1="14.5" x2="16.5" y2="14.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    titulo: "Prueba ZK",
    desc: "Se verifica tu elegibilidad sin revelar quién eres.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    titulo: "Voto",
    desc: "Tu prueba permite emitir el voto, sin tu identidad.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <rect x="4" y="9.5" width="16" height="10.5" rx="1.5" />
        <path d="M8 9.5V7a4 4 0 0 1 8 0v2.5" />
        <line x1="12" y1="13.5" x2="12" y2="16.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    titulo: "Verificación",
    desc: "Cualquiera puede comprobar el resultado, sin conocer tu identidad.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" strokeLinecap="round" />
        <path d="M7.8 10.5l1.8 1.8 3.2-3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const TECNOLOGIA = [
  {
    titulo: "Privacidad",
    desc: "Tu voto no te identifica.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      </svg>
    ),
  },
  {
    titulo: "Transparencia",
    desc: "Cualquier persona puede verificar el proceso.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
        <line x1="8.5" y1="8" x2="15.5" y2="8" strokeLinecap="round" />
        <line x1="8.5" y1="11.5" x2="15.5" y2="11.5" strokeLinecap="round" />
        <line x1="8.5" y1="15" x2="13" y2="15" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    titulo: "Seguridad",
    desc: "Resistente al fraude y a la manipulación.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    titulo: "Para todos",
    desc: "Accesible, transparente y ciudadana.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.4}>
        <circle cx="9" cy="8.5" r="3" />
        <circle cx="17" cy="9.5" r="2.4" />
        <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" strokeLinecap="round" />
        <path d="M15 15c2.5 0 4.5 2 4.5 5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const FAQ = [
  {
    pregunta: "¿El sistema puede saber por quién he votado?",
    respuesta:
      "No. La prueba de elegibilidad certifica que cumples los requisitos legales sin revelar quién eres. Tu voto queda ligado a un nullifier, nunca a tu identidad real.",
  },
  {
    pregunta: "¿Puedo votar dos veces?",
    respuesta:
      "No: cada prueba de elegibilidad genera un nullifier único por propuesta, y el contrato rechaza un segundo voto con el mismo nullifier.",
  },
  {
    pregunta: "¿Es esto legalmente vinculante en España?",
    respuesta:
      "No todavía. Es una prueba de concepto técnica; el voto electrónico vinculante está limitado por la LOREG. Ver el modelo de amenazas del repositorio para el detalle.",
  },
  {
    pregunta: "¿Quién puede comprobar los resultados?",
    respuesta:
      "Cualquiera: el recuento vive en un contrato público y auditable. Con tu recibo puedes verificar que tu voto quedó contado, sin revelar tu identidad.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero" id="top">
        <div className="hero-bg">
          <Image
            src="/images/civora-hero-bg.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-bg-img"
          />
          <div className="hero-overlay" />
        </div>

        <div className="wrap">
          <div className="hero-contenido">
            <div className="hero-kicker">
              <LogoMark size={56} />
              <span className="brand-text">
                <span className="brand-name">CÍVORA</span>
                <span className="brand-tagline">Infraestructura de votación verificable</span>
              </span>
            </div>
            <h1>
              Tu identidad acredita que puedes votar.
              <br />
              <span className="acento">Nunca revela qué has votado.</span>
            </h1>
            <p className="lede">
              Una nueva generación de votación digital basada en identidad
              certificada y pruebas criptográficas.
            </p>
            <div className="hero-actions">
              <Link className="btn-primary" href="/propuestas">
                Probar demostración →
              </Link>
              <a className="btn-ghost" href="#como-funciona">
                Cómo funciona
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="on-papel">
        <div className="wrap">
          <div className="section-head">
            <h2>Cómo funciona</h2>
            <p>Cuatro pasos, de tu identidad a un voto público e irreconocible.</p>
          </div>
          <div className="steps-grid">
            {PASOS.map((paso) => (
              <div className="step-card" key={paso.titulo}>
                <div className="step-icon">{paso.icono}</div>
                <h3>{paso.titulo}</h3>
                <p>{paso.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="requisitos" className="on-papel">
        <div className="wrap">
          <div className="section-head">
            <h2>Quién puede votar</h2>
            <p>Cuatro requisitos legales, comprobados sin almacenar tus datos.</p>
          </div>
          <div className="requisitos">
            <div className="requisito">
              <div className="requisito-check"></div>
              <div>
                <div className="requisito-title">Empadronamiento</div>
                <div className="requisito-desc">
                  Estar empadronado en cualquier municipio de España.
                </div>
              </div>
            </div>
            <div className="requisito">
              <div className="requisito-check"></div>
              <div>
                <div className="requisito-title">DNI español</div>
                <div className="requisito-desc">
                  Ser titular de un documento nacional de identidad español
                  vigente.
                </div>
              </div>
            </div>
            <div className="requisito">
              <div className="requisito-check"></div>
              <div>
                <div className="requisito-title">5 años de residencia</div>
                <div className="requisito-desc">
                  Residencia continuada en España durante al menos cinco años.
                </div>
              </div>
            </div>
            <div className="requisito">
              <div className="requisito-check"></div>
              <div>
                <div className="requisito-title">Mayoría de edad</div>
                <div className="requisito-desc">
                  Tener 18 años cumplidos en la fecha de la votación.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tech-dark">
        <div className="wrap">
          <div className="section-head on-oscuro">
            <h2>Tecnología al servicio de una democracia más fuerte.</h2>
          </div>
          <div className="tech-grid">
            {TECNOLOGIA.map((item) => (
              <div className="tech-item" key={item.titulo}>
                <div className="tech-icon">{item.icono}</div>
                <h3>{item.titulo}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="resultados" className="on-papel">
        <div className="wrap">
          <div className="section-head">
            <h2>Resultados, en abierto</h2>
            <p>Público desde el minuto uno, auditable por cualquiera.</p>
          </div>

          <div className="ledger-frame">
            <div className="ledger-top">
              <span className="ledger-top-label">
                propuesta de ejemplo — &quot;Presupuestos participativos 2027&quot;
              </span>
              <span className="ledger-top-badge">vista previa</span>
            </div>
            <div className="ledger-grid">
              <div className="ledger-cell">
                <AnimatedNumber value={48213} />
                <div className="ledger-cell-label">Registrados</div>
              </div>
              <div className="ledger-cell favor">
                <AnimatedNumber value={27904} />
                <div className="ledger-cell-label">A favor</div>
              </div>
              <div className="ledger-cell contra">
                <AnimatedNumber value={15332} />
                <div className="ledger-cell-label">En contra</div>
              </div>
              <div className="ledger-cell">
                <AnimatedNumber value={4977} />
                <div className="ledger-cell-label">Abstenciones</div>
              </div>
            </div>
            <div className="ledger-foot">
              Datos de ejemplo — ver el panel real en{" "}
              <Link className="link-quiet" href="/propuestas">
                /resultados
              </Link>
              .
            </div>
          </div>
        </div>
      </section>

      <section id="seguridad" className="on-papel">
        <div className="wrap">
          <div className="section-head">
            <h2>Con qué contar, y con qué no</h2>
            <p>Modelo de amenazas, sin adornos.</p>
          </div>

          <div className="garantias">
            <div>
              <h3>Lo que este sistema garantiza</h3>
              <ul className="col-si">
                <li>Nadie puede votar dos veces con el mismo documento.</li>
                <li>
                  Ni el operador ni nadie más puede alterar los votos ya
                  emitidos.
                </li>
                <li>Tu identidad nunca queda asociada a tu voto.</li>
                <li>
                  Solo puede votar quien posee físicamente su DNIe o
                  pasaporte.
                </li>
              </ul>
            </div>
            <div>
              <h3>Lo que aún queda por resolver</h3>
              <ul className="col-no">
                <li>
                  La verificación real del Padrón requiere convenio con el
                  INE.
                </li>
                <li>No evita la coacción en el momento de votar desde casa.</li>
                <li>Aún no es apto para elecciones oficiales vinculantes.</li>
                <li>
                  Falta auditoría externa de los contratos y del circuito ZK.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="on-papel">
        <div className="wrap">
          <div className="section-head">
            <h2>Preguntas frecuentes</h2>
          </div>
          <div className="faq-list">
            {FAQ.map((item) => (
              <div className="faq-item" key={item.pregunta}>
                <h3>{item.pregunta}</h3>
                <p>{item.respuesta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
