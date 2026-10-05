/** @type {import('next').NextConfig} */
const { crearCsp } = require("./lib/content-security-policy");
const { validarConfiguracionZkWeb, validarFalloAbiertoRevocacion } = require("./lib/runtime-security");

validarFalloAbiertoRevocacion(
  process.env.FALLO_ABIERTO_REVOCACION === "true",
  process.env.HARDHAT_RPC_URL,
  process.env.NODE_ENV
);
validarConfiguracionZkWeb(
  process.env.NEXT_PUBLIC_ZKPASSPORT_DOMAIN,
  process.env.NEXT_PUBLIC_ZKPASSPORT_DEV_MODE,
  process.env.HARDHAT_RPC_URL,
  process.env.NODE_ENV
);

const nextConfig = {
  reactStrictMode: true,
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
