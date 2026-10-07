# 0012. Next 15.5 y React 19.2

- **Estado:** aceptada
- **Fecha:** 2026-10-06

## Contexto

Next 14.2.35 acumulaba 23 avisos de seguridad sin corrección en la rama 14,
entre ellos dos críticos: ejecución remota de código sin autenticación en
la API de optimización de imágenes (GHSA-2xp9-vwfh-vxw4) y en servidores
Windows (GHSA-p293-qw3h-jr36). También un XSS en App Router con nonces de
CSP (GHSA-ffhc-5mcf-pf4q), que afecta justo a la protección que usa Civora.
Las correcciones solo existen en 15.5.x y 16.

## Decisión

- **Next 15.5.27** (última de la rama 15.5, etiqueta `backport` en npm) y
  **React y React DOM 19.2.8** con `@types/react` 19.2.18 y
  `@types/react-dom` 19.2.7. No se adopta Next 16: es otra versión mayor,
  con cambios propios, y se hará como tarea aparte.
- **`images.unoptimized: true`:** la portada usa `next/image`, pero sin
  optimizador; la API `/_next/image` desaparece (404) y con ella esa
  superficie de ataque.
- Las rutas ya eran compatibles: parámetros dinámicos leídos de la URL en
  las API y `useParams` en las páginas, sin `headers()` ni `cookies()`
  síncronos. `typecheck` ejecuta `next typegen` antes de `tsc`.
- `postcss` (Next fija 8.4.31), `source-map-js` y `ws` se fuerzan con
  `pnpm.overrides` a versiones corregidas.
- Dependabot ignora las versiones mayores de `next`, `react`, `react-dom` y
  sus tipos (`.github/dependabot.yml`).

## Alternativas

- **Next 16:** corrige lo mismo, pero añade otro salto mayor (cambios en
  middleware, caché y configuración) en la misma tarea que la corrección de
  seguridad.
- **Seguir en 14.2 con mitigaciones:** desactivar el optimizador no cubre
  el XSS con nonces, los DoS ni las SSRF.
- **React 19.3:** posterior a Next 15.5; se prefiere la 19.2 parcheada.

## Consecuencias

- CSP con nonce, validaciones de arranque, salida standalone y E2E con axe
  siguen en verde sin cambios de código en las páginas.
- `next start` avisa de que no sirve con `output: "standalone"`; por eso
  la salida standalone solo se activa en la imagen (`CIVORA_STANDALONE`).
- Las rutas del optimizador de imágenes ya no existen: cualquier imagen
  nueva debe ir en `public/` con su tamaño final.
- Pasar a Next 16 será una tarea propia del [ROADMAP](../ROADMAP.md#paso-a-producción).
