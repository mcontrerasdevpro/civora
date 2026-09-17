import Link from "next/link";

/**
 * Ya no existe una propuesta unica por defecto: cada votacion vive en
 * /votar/[id]. Esta pagina solo orienta a quien llega a /votar sin id.
 */
export default function VotarSinPropuestaPage() {
  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Votar</h1>
        <p>Elige primero una propuesta para poder votarla.</p>
      </div>
      <Link className="btn-primary" href="/propuestas">
        Ver propuestas →
      </Link>
    </main>
  );
}
