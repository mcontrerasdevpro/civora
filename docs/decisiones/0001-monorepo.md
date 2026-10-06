# 0001. Monorepo con esquema compartido

- **Estado:** aceptada
- **Fecha:** 2026-10-05 (documenta una decisión inicial del proyecto)

## Contexto

La web, el contrato y la capa de identidad manejan los mismos conceptos
(propuesta, opción, voto, resultados). Si cada parte define sus tipos por
separado, divergen sin que nadie lo note.

## Decisión

Un único repositorio pnpm con `apps/web`, `packages/contracts`,
`packages/zk-identity` y `packages/shared-types`. El esquema de propuesta,
voto y resultados vive solo en `shared-types` (Zod) y lo importan los demás.

## Alternativas

- **Repositorios separados:** versionado independiente, pero exige publicar
  paquetes y sincronizar versiones del esquema.
- **Copiar los tipos en cada parte:** sin coste inicial, con divergencia
  asegurada.

## Consecuencias

- Un cambio de esquema se ve y se prueba en todas las partes en el mismo PR.
- Los comandos se lanzan con `pnpm --filter` ([AGENTS.md](../../AGENTS.md#comandos)).
- La web transpila `shared-types` (`transpilePackages` en `next.config.js`).
