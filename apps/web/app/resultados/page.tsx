import Link from "next/link";

/**
 * Ya no existe una propuesta unica por defecto: los resultados de cada
 * votacion viven en /resultados/[id]. Esta pagina solo orienta a quien
 * llega a /resultados sin id.
 */
export default function ResultadosSinPropuestaPage() {
  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Resultados</h1>
        <p>Elige una propuesta para ver sus resultados.</p>
      </div>
      <Link className="btn-primary" href="/propuestas">
        Ver propuestas →
      </Link>
    </main>
  );
}
