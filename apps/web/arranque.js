/**
 * Punto de entrada de la imagen Docker. El servidor standalone de Next
 * (server.js) no ejecuta next.config.js, así que aquí se repiten las
 * validaciones de arranque antes de cargarlo. Si fallan, el proceso termina
 * con código 1 y el contenedor no arranca.
 */
const { validarEntorno } = require("./lib/validar-entorno.js");

try {
  validarEntorno();
} catch (error) {
  console.error(`[civora] configuración no válida: ${error instanceof Error ? error.message : "error desconocido"}`);
  process.exit(1);
}

require("./server.js");
