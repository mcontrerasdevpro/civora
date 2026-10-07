# 0007. CSP con nonce y CSP de desarrollo

- **Estado:** aceptada
- **Fecha:** 2026-10-05; CSP de desarrollo, 2026-10-06

## Contexto

La web maneja identidad y votos: un script inyectado podría leer o alterar
la opción antes de enviarla. Además carga código de terceros (SDK de
ZKPassport, `autoscript.js` de Autofirma).

## Decisión

- `middleware.ts` genera un nonce por petición y
  `lib/content-security-policy.js` construye la política:
  `script-src 'self' 'nonce-…' 'strict-dynamic'`, sin `unsafe-inline` para
  scripts, `media-src 'self'`, `connect-src` limitado a ZKPassport y a Autofirma en `127.0.0.1` (`wss`
  y `https`), `frame-src 'self' afirma:` para abrir Autofirma,
  `object-src 'none'` y `frame-ancestors 'none'`.
- Fuentes autoalojadas con `next/font` y ningún script inline.
- Solo con `NODE_ENV=development` se añade `'unsafe-eval'`, que `next dev`
  necesita para hidratar. Build y start no lo incluyen nunca.

## Alternativas

- **CSP sin nonce con `unsafe-inline`:** más sencilla, pero no protege
  contra inyección.
- **Sin CSP en desarrollo:** ocultaría en local los errores de CSP que
  aparecerían en producción.

## Consecuencias

- Cualquier script nuevo debe cargarse con nonce o desde un script ya
  autorizado.
- Un test unitario y otro E2E (cabecera real de `next start`) fallan si la
  CSP de producción contiene `'unsafe-eval'`.
- `test:e2e` se ejecuta contra la build de producción para probar su CSP
  real.
