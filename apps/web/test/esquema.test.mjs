import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Cada esquema se crea una vez por proceso y se guarda la promesa. Si esa
// promesa falla y no se descarta, todas las consultas posteriores fallan
// hasta reiniciar (2026-10-09: /api/propuestas devolvía 500 tras un
// despliegue). Toda promesa de esquema cacheada debe volver a null al fallar.
test("las promesas de esquema cacheadas se descartan si fallan", async () => {
  for (const ruta of ["../lib/db.ts", "../lib/intentos-repetidos.ts"]) {
    const fuente = await readFile(new URL(ruta, import.meta.url), "utf8");
    const cacheadas = [...fuente.matchAll(/^\s*(esquema\w*) = query\(/gm)].map((m) => m[1]);
    assert.ok(cacheadas.length > 0, ruta);
    for (const nombre of cacheadas) {
      assert.match(fuente, new RegExp(String.raw`${nombre} = null;\s*throw error;`), `${ruta}: ${nombre}`);
    }
  }
});
