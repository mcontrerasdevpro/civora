/**
 * Next llama a register() una vez al arrancar el servidor. Aquí solo se
 * lanza el indexador de eventos (ADR 0020), sin esperar a que termine, para
 * no retrasar el arranque. Necesita Node y Postgres: la importación va dentro
 * del `if` para que Next la elimine de la compilación para Edge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarIndexador, indexadorHabilitado } = await import("./lib/indexador-eventos");
    if (indexadorHabilitado()) iniciarIndexador();
  }
}
