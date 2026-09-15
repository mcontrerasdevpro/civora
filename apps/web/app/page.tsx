import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Voto Anónimo — Prueba de concepto</h1>
      <p>
        Sistema de voto anónimo y verificable, con identificación por DNI o
        certificado digital y voto desvinculado de la identidad real.
      </p>
      <nav>
        <ul>
          <li>
            <Link href="/votar">Votar</Link>
          </li>
          <li>
            <Link href="/resultados">Ver resultados</Link>
          </li>
          <li>
            <Link href="/verificar">Verificar mi voto</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
