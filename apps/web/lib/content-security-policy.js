/**
 * `entorno` solo relaja la política con "development": `next dev` evalúa
 * código (react-refresh) y sin 'unsafe-eval' las páginas no se hidratan.
 * Build y start (NODE_ENV "production") nunca lo incluyen.
 */
function crearCsp(
  nonce,
  dominioZk = process.env.NEXT_PUBLIC_ZKPASSPORT_DOMAIN ?? "demo.zkpassport.id",
  entorno = process.env.NODE_ENV
) {
  let hostZk = "demo.zkpassport.id";
  try {
    hostZk = new URL(`https://${dominioZk}`).host;
  } catch {
    // Se mantiene el host de demo si la variable de entorno no es un dominio válido.
  }

  const evalDesarrollo = entorno === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalDesarrollo}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self'",
    `connect-src 'self' https://${hostZk} wss://${hostZk} https://*.zkpassport.id wss://*.zkpassport.id http://localhost:* http://127.0.0.1:*`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

module.exports = { crearCsp };