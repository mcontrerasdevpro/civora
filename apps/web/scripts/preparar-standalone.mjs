/**
 * Completa la salida `output: "standalone"` de Next con lo que no copia por
 * sí misma. Lo usan el Dockerfile y los E2E, para que la lista de archivos
 * de la imagen esté en un único sitio:
 *   - .next/static y public (Next no los incluye en standalone);
 *   - lib/certificados-raiz (se leen del disco al verificar certificados);
 *   - arranque.js y las validaciones que importa (el servidor standalone no
 *     ejecuta next.config.js).
 */
import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// Con outputFileTracingRoot en la raíz del monorepo, la app queda en apps/web.
const destino = path.join(web, ".next", "standalone", "apps", "web");

await stat(path.join(destino, "server.js")).catch(() => {
  throw new Error("Falta .next/standalone/apps/web/server.js: ejecuta antes `next build`.");
});

const copias = [
  [".next/static", ".next/static"],
  ["public", "public"],
  ["lib/certificados-raiz", "lib/certificados-raiz"],
  ["arranque.js", "arranque.js"],
  ["lib/validar-entorno.js", "lib/validar-entorno.js"],
  ["lib/runtime-security.js", "lib/runtime-security.js"],
];

for (const [origen, final] of copias) {
  const rutaFinal = path.join(destino, final);
  await rm(rutaFinal, { recursive: true, force: true });
  await cp(path.join(web, origen), rutaFinal, { recursive: true });
}

// Next copia .env y .env.production si existen al construir: nunca deben ir
// en la imagen ni en el artefacto.
for (const archivo of [".env", ".env.production", ".env.local"]) {
  await rm(path.join(destino, archivo), { force: true });
}

console.log(`Standalone preparado en ${path.relative(web, destino)}`);
