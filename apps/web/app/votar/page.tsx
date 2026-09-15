"use client";

/**
 * Flujo de voto, en 3 pasos:
 *  1. Identificación (DNIe / certificado digital) -> genera prueba ZK
 *     de elegibilidad, vía @voto-anonimo/zk-identity.
 *  2. Emisión del voto (a favor / en contra / abstención), firmado con
 *     el nullifier derivado de la prueba, no con la identidad real.
 *  3. Recibo anónimo, para verificar el voto más tarde en /verificar.
 *
 * TODO: conectar con packages/zk-identity y packages/contracts.
 */
export default function VotarPage() {
  return (
    <main>
      <h1>Votar</h1>
      <p>Flujo pendiente de implementar: identificación → voto → recibo.</p>
    </main>
  );
}
