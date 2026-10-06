/** @type {import('next').NextConfig} */
const path = require("path");
const { crearCsp } = require("./lib/content-security-policy");
const { validarEntorno } = require("./lib/validar-entorno");

// Validaciones de arranque (dev, build y next start). La imagen Docker las
// repite en arranque.js porque el servidor standalone no ejecuta este archivo.
validarEntorno();

// Monorepo: el trazado de archivos del build standalone parte de la raíz para
// incluir los paquetes del workspace. Next 14 lee la opción en `experimental`
// y Next 15 en el nivel superior.
const raizMonorepo = path.join(__dirname, "../..");
const versionMayorNext = Number.parseInt(require("next/package.json").version, 10);
const trazado =
  versionMayorNext >= 15
    ? { outputFileTracingRoot: raizMonorepo }
    : { experimental: { outputFileTracingRoot: raizMonorepo } };

// Salida standalone solo para la imagen Docker (CIVORA_STANDALONE=true en el
// Dockerfile). En Windows, Next no puede crear los enlaces simbólicos de pnpm
// dentro de .next/standalone sin permisos de administrador y el build falla.
const salida = process.env.CIVORA_STANDALONE === "true" ? { output: "standalone" } : {};

const nextConfig = {
  reactStrictMode: true,
  ...salida,
  ...trazado,
  transpilePackages: ["@civora/shared-types"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: crearCsp("__CSP_NONCE__") }],
      },
    ];
  },
};

module.exports = nextConfig;
