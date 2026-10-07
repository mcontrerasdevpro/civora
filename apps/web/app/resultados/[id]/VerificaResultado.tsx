import type { VerificacionResultados } from "../../../lib/verificacion-resultados";

const TRANSACCIONES_VISIBLES = 10;

type Props = {
  estado: { fase: "cargando" } | { fase: "error" } | { fase: "lista"; verificacion: VerificacionResultados };
  coincideConContrato: boolean | null;
  sencillo: boolean;
};

function Enlace({ base, ruta, texto }: { base: string | null; ruta: string; texto: string }) {
  return base ? (
    <a className="link-quiet hash" href={`${base}${ruta}`} rel="noopener noreferrer" target="_blank">
      {texto}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  ) : (
    <code className="hash">{texto}</code>
  );
}

function EstadoRecuento({ verificacion, coincide }: { verificacion: VerificacionResultados; coincide: boolean | null }) {
  const { recuento } = verificacion;
  if (!recuento.disponible) {
    return (
      <p className="alert alert-info">
        {recuento.motivo === "rango"
          ? "Este servidor no recorre los eventos de una votación tan larga con su proveedor de la red: rehaz el recuento con los pasos de abajo."
          : "Ahora no se han podido leer los eventos desde este servidor: rehaz el recuento con los pasos de abajo o inténtalo más tarde."}
      </p>
    );
  }
  return coincide ? (
    <p className="alert alert-ok" role="status">
      <strong>Comprobado:</strong> el recuento rehecho desde los {recuento.total.toLocaleString("es-ES")} eventos
      públicos coincide con el que guarda el contrato.
    </p>
  ) : (
    <p className="alert alert-error" role="alert">
      <strong>No coincide:</strong> el recuento rehecho desde los eventos no es igual al del contrato. Revisa los
      pasos de abajo con tu propio nodo y avisa al equipo de Civora como indica su política de seguridad
      (SECURITY.md del repositorio).
    </p>
  );
}

export function VerificaResultado({ estado, coincideConContrato, sencillo }: Props) {
  return (
    <section className="verifica-resultado" aria-labelledby="titulo-verifica">
      <details open={!sencillo}>
        <summary>
          <h2 id="titulo-verifica">{sencillo ? "Comprobar este resultado por su cuenta" : "Verifica este resultado"}</h2>
        </summary>

        {estado.fase === "cargando" && <p className="form-hint">Cargando los datos para verificar…</p>}
        {estado.fase === "error" && (
          <p className="alert alert-error">No se han podido cargar los datos para verificar el resultado.</p>
        )}

        {estado.fase === "lista" && (
          <>
            <EstadoRecuento verificacion={estado.verificacion} coincide={coincideConContrato} />

            <h3>Dónde están los datos</h3>
            <dl className="datos-verificacion">
              <dt>Contrato</dt>
              <dd>
                <Enlace
                  base={estado.verificacion.explorador}
                  ruta={`/address/${estado.verificacion.contrato}#events`}
                  texto={estado.verificacion.contrato}
                />
              </dd>
              <dt>Identificador de la propuesta en el contrato</dt>
              <dd>
                <code className="hash">{estado.verificacion.propuestaIdBytes32}</code>
              </dd>
              <dt>Evento que hay que contar</dt>
              <dd>
                <code className="hash">{estado.verificacion.firmaEvento}</code>
                <br />
                <span className="form-hint">
                  Primer tema (topic0): <code className="hash">{estado.verificacion.topicEvento}</code>
                </span>
              </dd>
              {estado.verificacion.bloques && (
                <>
                  <dt>Bloques de la votación</dt>
                  <dd>
                    del {estado.verificacion.bloques.desde.toLocaleString("es-ES")} al{" "}
                    {estado.verificacion.bloques.hasta.toLocaleString("es-ES")}
                  </dd>
                </>
              )}
            </dl>

            {estado.verificacion.recuento.disponible && estado.verificacion.recuento.totalTransacciones > 0 && (
              <>
                <h3>Transacciones de los votos</h3>
                <ul className="lista-transacciones">
                  {estado.verificacion.recuento.transacciones.slice(0, TRANSACCIONES_VISIBLES).map((hash) => (
                    <li key={hash}>
                      <Enlace base={estado.verificacion.explorador} ruta={`/tx/${hash}`} texto={hash} />
                    </li>
                  ))}
                </ul>
                {estado.verificacion.recuento.totalTransacciones > TRANSACCIONES_VISIBLES && (
                  <p className="form-hint">
                    Y {(estado.verificacion.recuento.totalTransacciones - TRANSACCIONES_VISIBLES).toLocaleString("es-ES")}{" "}
                    más: están todas en los eventos del contrato.
                  </p>
                )}
              </>
            )}

            <h3>Cómo rehacer el recuento</h3>
            <ol className="pasos-recuento">
              <li>
                Pide a cualquier nodo de la red los eventos <code>VotoEmitido</code> del contrato cuyo primer
                parámetro indexado sea el identificador de la propuesta, entre los bloques indicados.
              </li>
              <li>
                Cuenta la opción de cada evento: <code>0</code> es A favor, <code>1</code> En contra y{" "}
                <code>2</code> Abstención. Cada voto tiene un identificador anónimo distinto (segundo parámetro);
                ninguno puede repetirse.
              </li>
              <li>
                Compara tu recuento con la función pública <code>resultados(identificador)</code> del contrato y
                con los números de esta página.
              </li>
              <li>
                La vía de cada voto se ve en su transacción: <code>votarManual</code> es certificado digital y{" "}
                <code>votarConPruebaZk</code> es DNIe o pasaporte (ZKPassport).
              </li>
            </ol>
            <p className="form-hint">Por ejemplo, con Foundry y tu propio proveedor de la red:</p>
            <pre className="comando">
              <code>
                {`cast logs --rpc-url <tu-rpc> --address ${estado.verificacion.contrato} \\\n`}
                {estado.verificacion.bloques
                  ? `  --from-block ${estado.verificacion.bloques.desde} --to-block ${estado.verificacion.bloques.hasta} \\\n`
                  : ""}
                {`  "VotoEmitido(bytes32 indexed,bytes32 indexed,uint8)" ${estado.verificacion.propuestaIdBytes32}`}
              </code>
            </pre>
          </>
        )}
      </details>
    </section>
  );
}
