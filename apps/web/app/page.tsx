import Link from "next/link";
import { AnimatedNumber } from "./components/AnimatedNumber";

export default function Home() {
  return (
    <>
      <header className="site">
        <div className="wrap site-bar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true"></span>
            <span className="brand-name">Voto Anónimo</span>
          </div>
          <nav className="site-nav">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#requisitos">Requisitos</a>
            <a href="#resultados">Resultados</a>
            <a href="#garantias">Garantías</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" style={{ borderTop: "none", paddingTop: 76 }}>
          <div className="wrap" style={{ display: "contents" }}>
            <div>
              <h1>
                Tu identidad, certificada.
                <br />
                Tu voto, irreconocible.
              </h1>
              <p className="lede">
                Un sistema de votación donde solo pueden participar las
                personas que cumplen los requisitos legales — y donde nadie,
                ni siquiera el propio sistema, puede saber qué votaron.
              </p>
              <div className="hero-actions">
                <a className="btn-primary" href="#como-funciona">
                  Ver cómo funciona
                </a>
                <a className="link-quiet" href="#garantias">
                  Leer el modelo de amenazas
                </a>
              </div>
              <div className="hero-actions" style={{ marginTop: 20 }}>
                <Link className="link-quiet" href="/votar">
                  Ir al formulario de voto
                </Link>
                <Link className="link-quiet" href="/resultados">
                  Ver panel de resultados
                </Link>
                <Link className="link-quiet" href="/verificar">
                  Verificar mi voto
                </Link>
              </div>
            </div>

            <div className="diagram">
              <div className="diagram-label">flujo de un voto</div>
              <div className="diagram-row">
                <div className="diagram-node">
                  <div className="node-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1B1A17" strokeWidth={1.3}>
                      <rect x="2.5" y="5" width="19" height="14" rx="0.5" />
                      <circle cx="8.5" cy="12" r="2.3" />
                      <line x1="13" y1="9.5" x2="18.5" y2="9.5" />
                      <line x1="13" y1="12" x2="18.5" y2="12" />
                      <line x1="13" y1="14.5" x2="16.5" y2="14.5" />
                    </svg>
                  </div>
                  <div className="node-title">DNIe</div>
                  <div className="node-sub">identidad real</div>
                </div>

                <div className="diagram-arrow"></div>

                <div className="diagram-node">
                  <div className="node-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1B1A17" strokeWidth={1.3}>
                      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="node-title">Prueba ZK</div>
                  <div className="node-sub">0x8f2a…c19e</div>
                </div>

                <div className="diagram-arrow"></div>

                <div className="diagram-node">
                  <div className="node-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1B1A17" strokeWidth={1.3}>
                      <rect x="4" y="3.5" width="16" height="17" rx="0.5" />
                      <line x1="7.5" y1="8" x2="16.5" y2="8" />
                      <line x1="7.5" y1="11" x2="16.5" y2="11" />
                      <rect x="7.5" y="14.2" width="3" height="3" rx="0.5" />
                    </svg>
                  </div>
                  <div className="node-title">Voto</div>
                  <div className="node-sub">sin titular</div>
                </div>
              </div>

              <div className="stamp">verificado</div>

              <p className="diagram-note">
                El sistema comprueba edad, DNI español, empadronamiento y 5
                años de residencia sin llegar a conocer nunca quién eres.
              </p>
            </div>
          </div>
        </section>

        <section id="como-funciona">
          <div className="wrap">
            <div className="section-head">
              <h2>Cómo funciona</h2>
              <span className="section-num">3 pasos</span>
            </div>

            <div className="steps">
              <div className="step">
                <div className="step-index">01</div>
                <div className="step-title">Identifícate</div>
                <div className="step-desc">
                  Escaneas el chip de tu DNIe o pasaporte. El sistema
                  comprueba que cumples los requisitos de voto sin guardar
                  tus datos personales.
                </div>
              </div>
              <div className="step">
                <div className="step-index">02</div>
                <div className="step-title">Recibes un pase de voto</div>
                <div className="step-desc">
                  Una prueba criptográfica certifica tu elegibilidad. No
                  lleva tu nombre ni tu DNI — solo demuestra que tienes
                  derecho a votar una vez.
                </div>
              </div>
              <div className="step">
                <div className="step-index">03</div>
                <div className="step-title">Votas y guardas tu recibo</div>
                <div className="step-desc">
                  Tu voto queda registrado públicamente junto a los demás.
                  Con tu recibo puedes comprobar que se ha contado, sin
                  revelar cuál era.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="requisitos">
          <div className="wrap">
            <div className="section-head">
              <h2>Quién puede votar</h2>
              <span className="section-num">4 requisitos</span>
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
                    Ser titular de un documento nacional de identidad
                    español vigente.
                  </div>
                </div>
              </div>
              <div className="requisito">
                <div className="requisito-check"></div>
                <div>
                  <div className="requisito-title">5 años de residencia</div>
                  <div className="requisito-desc">
                    Residencia continuada en España durante al menos cinco
                    años.
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

        <section id="resultados">
          <div className="wrap">
            <div className="section-head">
              <h2>Resultados, en abierto</h2>
              <span className="section-num">público desde el minuto uno</span>
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
                Datos de ejemplo — el panel real se conecta en directo al
                registro público de votos.
              </div>
            </div>
          </div>
        </section>

        <section id="garantias">
          <div className="wrap">
            <div className="section-head">
              <h2>Con qué contar, y con qué no</h2>
              <span className="section-num">modelo de amenazas</span>
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
                    La verificación real del Padrón requiere convenio con
                    el INE.
                  </li>
                  <li>No evita la coacción en el momento de votar desde casa.</li>
                  <li>Aún no es apto para elecciones oficiales vinculantes.</li>
                  <li>
                    Falta auditoría externa de los contratos y del circuito
                    ZK.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site">
        <div className="wrap footer-row">
          <p>
            Prueba de concepto — no vinculante. Ver especificación pública y
            modelo de amenazas en el repositorio.
          </p>
          <div className="footer-links">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#garantias">Modelo de amenazas</a>
            <a
              href="https://github.com/mcontrerasdevpro/voto-anonimo"
              target="_blank"
              rel="noreferrer"
            >
              Repositorio
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
