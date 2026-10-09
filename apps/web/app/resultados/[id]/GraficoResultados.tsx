import type { OpcionResultado, Reparto } from "../../../lib/porcentajes-resultados.mjs";

/**
 * Gráfica de barras en SVG propio, sin librerías ni scripts inline. Cada
 * opción se distingue por su texto, su color y su trama (lisa, rayas o
 * puntos), así que no depende solo del color. Los números se leen como
 * texto; las barras son decorativas para los lectores de pantalla.
 */
function Tramas() {
  return (
    <svg className="tramas-resultados" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="trama-a_favor" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" className="trama-a_favor" />
        </pattern>
        <pattern id="trama-en_contra" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" className="trama-en_contra" />
          <rect width="3" height="8" className="trama-claro" />
        </pattern>
        <pattern id="trama-abstencion" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" className="trama-abstencion" />
          <circle cx="4" cy="4" r="1.6" className="trama-claro" />
        </pattern>
      </defs>
    </svg>
  );
}

function Muestra({ opcion }: { opcion: OpcionResultado }) {
  return (
    <svg className="muestra-opcion" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="17" height="17" rx="4" fill={`url(#trama-${opcion})`} className="barra-borde" />
    </svg>
  );
}

export function GraficoResultados({ reparto }: { reparto: Reparto }) {
  return (
    <figure className="grafico-resultados">
      <figcaption className="grafico-titulo">Votos emitidos por opción</figcaption>
      <Tramas />
      <ul className="barras">
        {reparto.filas.map((fila) => {
          const ancho = fila.decimas === null ? 0 : fila.decimas / 10;
          return (
            <li key={fila.opcion} className={`barra-fila barra-${fila.opcion}`}>
              <div className="barra-cabecera">
                <span className="barra-etiqueta">
                  <Muestra opcion={fila.opcion} />
                  {fila.etiqueta}
                </span>
                <span className="barra-valor">
                  <strong>{fila.votos.toLocaleString("es-ES")}</strong>{" "}
                  {fila.votos === 1 ? "voto" : "votos"}
                  {fila.porcentaje && <> · {fila.porcentaje}</>}
                </span>
              </div>
              <svg
                className="barra-svg"
                width="100%"
                aria-hidden="true"
                focusable="false"
              >
                <rect className="barra-fondo" width="100%" height="100%" rx="6" />
                {ancho > 0 && (
                  <rect
                    className="barra-borde"
                    width={`${ancho}%`}
                    height="100%"
                    rx="6"
                    fill={`url(#trama-${fila.opcion})`}
                  />
                )}
              </svg>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
