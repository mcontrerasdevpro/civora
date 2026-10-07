# 0017. Separación en servicios por frontera de confianza, en monorepo

- **Estado:** propuesta (diseño; pendiente de las decisiones del responsable listadas al final)
- **Fecha:** 2026-10-07
- **Amplía:** [ADR 0001](0001-monorepo.md) (monorepo) y [ADR 0011](0011-alojamiento-vps-propio.md) (un solo servicio `civora`)
- **Relacionada:** [ADR 0004](0004-relayer-inmutable.md), [ADR 0016](0016-propuestas-registro-ideas-multifirma-ipfs.md), M-02 de la [auditoría](../auditoria-seguridad.md#m-02--medio--el-relayer-reduce-la-exposición-de-la-wallet-del-votante-pero-concentra-confianza-y-correlación)

## Contexto

La web es un único proceso Next.js que tiene todos los secretos a la vez:

| Variable | Para qué | Dónde se usa hoy |
|---|---|---|
| `HARDHAT_RELAYER_PRIVATE_KEY` | Firmar y pagar todas las transacciones; única cuenta que puede llamar a `votarManual` y `crearPropuesta` | `apps/web/lib/contrato.ts` |
| `NULLIFIER_CERTIFICADO_SECRET` | HMAC del DNI → nullifier de certificado (R-02) | `apps/web/lib/nullifier-certificado.mjs` |
| `RETO_CERTIFICADO_SECRET` | HMAC del reto firmado con Autofirma | `apps/web/lib/certificado-digital.ts` |
| `DATABASE_URL` | Contenido de las propuestas | `apps/web/lib/db.ts` |
| `HARDHAT_RPC_URL` | Lectura y envío a la cadena (lleva la clave de Alchemy) | `apps/web/lib/contrato.ts` |

Una vulnerabilidad en cualquier dependencia de la web (Next, React, el SDK
de ZKPassport) o en cualquier ruta da acceso a todo eso. En concreto, con
la clave del relayer se pueden emitir **votos de certificado falsos**,
porque `votarManual` solo comprueba `msg.sender == relayer`
([`VotacionAnonima.sol`](../../packages/contracts/contracts/VotacionAnonima.sol)).
Con `NULLIFIER_CERTIFICADO_SECRET` se puede calcular el nullifier de
cualquier DNI y ver qué votó en cadena.

### Referencia estudiada

El `gateway` de spain-in-parallel (commit a74caad) separa sus funciones en
módulos, pero **las ejecuta en un único proceso con las dos claves**:
`server.mjs:1-4` («One process, one port, both roles») y
`server.mjs:44` y `:73`. Lo aprovechable es su relayer
(`relayer/config.mjs` y `relayer/relay.mjs`):

- Lista blanca de destino y selector de 4 bytes
  (`relay.mjs:75-91`), con la tabla de selectores precalculada a partir de
  las firmas (`relay.mjs:59-68`).
- `estimateGas` antes de enviar, para que una llamada que va a fallar no
  cueste gas (`relay.mjs:104-110`).
- Tope de gas por transacción (`config.mjs:45`, 3 000 000).

Lo que **no** conviene copiar de ese relayer:

- No autentica a quien llama ni limita el gasto total.
- Registra mensajes de error completos y fragmentos de `passport_hash`
  (`server.mjs:55`, `:62` y `:66`), algo que las reglas de registro de
  Civora prohíben (`lib/registro.mjs`).
- Su *registrator* verifica la cadena CSCA con `node-forge`
  (`registrator/passive-auth.mjs:28` y `:173`), la librería que Civora ya
  retiró del runtime por GHSA-86w9-cpqp-85rv
  ([auditoría](../auditoria-seguridad.md#dependencias-2026-10-06-rama-actualizar-dependencias)).
  Además se declara «AUDIT PENDING» (`passive-auth.mjs:19-26`).

## Decisión propuesta

Tres servicios desplegables por separado, en el mismo repositorio, cada uno
con su imagen Docker y solo los secretos que necesita.

### Servicios y secretos

| Servicio | Responsabilidad | Secretos | Expuesto a Internet |
|---|---|---|---|
| `web` (`apps/web`) | Páginas, lectura de la cadena y de IPFS, caché en `civora-db`, entrada de votos ZK y de propuestas | `DATABASE_URL` (rol de Postgres limitado a sus tablas), RPC de solo lectura, `TOKEN_RELAYER_WEB` | Sí, `civora.nexuraia.com` |
| `relayer` (`apps/relayer`) | Única clave que paga gas; retransmite solo llamadas de la lista blanca | `HARDHAT_RELAYER_PRIVATE_KEY`, RPC de envío, `TOKEN_RELAYER_WEB` y `TOKEN_RELAYER_IDENTIDAD` (para verificar) | **No.** Solo red interna |
| `identidad` (`apps/identidad`) | Reto y verificación del certificado (CMS, cadena FNMT/DGP, OCSP), cálculo del nullifier de certificado y, con el ADR 0016, cupo de propuestas por persona | `NULLIFIER_CERTIFICADO_SECRET`, `RETO_CERTIFICADO_SECRET`, `FALLO_ABIERTO_REVOCACION`, `TOKEN_RELAYER_IDENTIDAD` | Solo las rutas del flujo de certificado (ver abajo) |

- **«Web sin secretos»** quiere decir sin secretos que permitan votar,
  firmar o pagar. La web sigue necesitando credenciales de base de datos y
  de RPC, pero con privilegios mínimos.
- **El reto de certificado no guarda estado** (HMAC con caducidad en
  `certificado-digital.ts`), así que `identidad` no necesita base de datos.

### Comunicación

- **Red interna de Docker** del proyecto en Easypanel. `relayer` no tiene
  dominio ni puerto publicado.
- **Autenticación entre servicios:** cada cliente tiene su propio token y
  firma con él cada petición: un HMAC-SHA256 del método, la ruta, la marca de
  tiempo y el cuerpo, en una cabecera. El relayer rechaza peticiones de más
  de 30 s y compara en tiempo constante.
  - Es más sencillo que mTLS y suficiente dentro de una red interna.
  - mTLS se reconsidera con el VPS dedicado.
- **Permisos por cliente en el relayer** (lista blanca estilo `gateway`,
  ampliada):

  | Cliente | Destino | Funciones |
  |---|---|---|
  | `web` | `VotacionAnonima` | `votarConPruebaZk` |
  | `web` | `RegistroIdeas` (ADR 0016) | `proponer`, con el tope diario |
  | `web` | Safe del consejo (ADR 0016) | `execTransaction` |
  | `identidad` | `VotacionAnonima` | `votarManual` |

  - Además: `estimateGas` previo, tope de gas por transacción y **tope de
    gasto diario** (hoy pendiente en el
    [ROADMAP](../ROADMAP.md#paso-a-producción)).
  - Una sola instancia gestiona el *nonce*, y el saldo de la cuenta se
    mantiene bajo y se recarga a mano.
  - La lista blanca se genera con el ABI compilado del mismo commit (ver
    [Por qué monorepo](#por-qué-monorepo)).
- **Flujo de certificado:** el navegador habla con `identidad` sin pasar
  por la web. Recomendado: el proxy de Easypanel enruta
  `civora.nexuraia.com/identidad/*` a ese servicio, en el mismo origen, sin
  tocar la CSP. Si Easypanel no permite enrutar por ruta, se usa un
  subdominio `identidad.civora.nexuraia.com` con CORS limitado al origen de
  la web y `connect-src` ampliado.
  - Así **la web deja de ver el certificado**.
  - No cambia A-01: `identidad` sigue recibiendo certificado y opción a la
    vez hasta la Fase 1.
- **Registros:** los tres servicios usan `lib/registro.mjs`, que pasa a un
  paquete compartido. Contexto fijo y código corto, nunca IPs, cuerpos,
  firmas ni nullifiers.

### Si se compromete cada servicio

| Servicio comprometido | Qué consigue el atacante | Qué no consigue |
|---|---|---|
| `web` | Cambiar la interfaz, incluido mostrar una opción y hacer que el navegador vincule otra en la prueba ZK. Agotar el presupuesto diario del relayer con llamadas válidas. Leer la caché de propuestas | Votos de certificado falsos (no tiene `TOKEN_RELAYER_IDENTIDAD`); calcular nullifiers de DNI; la clave del relayer; votos ZK sin prueba válida |
| `relayer` | Gastar el saldo de la cuenta. **Emitir votos de certificado falsos** (`votarManual`) hasta la Fase 1. Retrasar o descartar votos (censura) | Votos ZK sin prueba; conocer identidades; nullifiers de DNI concretos |
| `identidad` | Votos de certificado falsos a través del relayer, dentro de su tope. Vincular DNI y opción de quien vota con certificado. Calcular el nullifier de cualquier DNI | La clave del relayer; votos ZK; contenido de las propuestas |

Consecuencias de la tabla:

- **La separación protege las claves, no al votante de una web maliciosa.**
  Contra eso siguen haciendo falta builds reproducibles, la verificación del
  recibo y, en la Fase 2, el secreto de papeleta.
- **Hasta la Fase 1, `relayer` e `identidad` son igual de críticos para la
  vía de certificado.** Opción de futuro, que cambia el contrato: que
  `votarManual` exija además una firma de una clave propia de `identidad`.
  Así comprometer solo el relayer no bastaría.

### Estructura del repositorio

```
apps/
  web/          Next.js (sin cambios de framework)
  relayer/      Node 22, HTTP mínimo; lista blanca derivada del ABI
  identidad/    Node 22; mueve certificado-digital, cadena-certificados,
                nif-certificado, nullifier-certificado y certificados-raiz
packages/
  contracts/  shared-types/  zk-identity/   (como ahora)
  servicios/    registro, validación de entorno y firma entre servicios
docker/
  web.Dockerfile  relayer.Dockerfile  identidad.Dockerfile
```

- **Imágenes:** una por servicio, con el mismo patrón que el `Dockerfile`
  actual: base fijada por digest, `--frozen-lockfile` con
  `--filter "<servicio>..."`, usuario no root, `HEALTHCHECK` y validaciones
  de arranque.
- **CI:** el job «Imagen Docker» pasa a ser una matriz de tres. Cada imagen
  se construye, arranca, responde a su `/salud` y se comprueba que no
  contiene `.env` ni secretos de otro servicio. En los tests de
  `apps/web` ya no puede aparecer `HARDHAT_RELAYER_PRIVATE_KEY`.
- **Easypanel**, en el proyecto `nexuraia`:
  - `civora` (web, con dominio), `civora-relayer` (sin dominio) y
    `civora-identidad` (ruta o subdominio), más `civora-db`.
  - Las variables de cada servicio solo incluyen sus secretos.
  - Orden de despliegue: `relayer` → `identidad` → `web`.
- **Memoria estimada:**

  | Servicio | Memoria estimada |
  |---|---|
  | `web` | 200-300 MB |
  | `relayer` | 60-100 MB |
  | `identidad` | 80-120 MB |
  | `civora-db` | 50-150 MB |

  - En total, entre 150 y 250 MB más que hoy, en un VPS KVM 2 (8 GB)
    compartido con los n8n de producción.
  - Son estimaciones: hay que medirlas con `docker stats` y fijar un límite
    de memoria por servicio en Easypanel, para que un fallo de Civora no
    deje sin memoria a n8n.

### Por qué monorepo

- **Cambios atómicos:**
  - La lista blanca del relayer depende de los selectores del contrato y
    `identidad` depende del formato de `votarManual`.
  - En un solo repositorio, un cambio de contrato, de lista blanca y de
    web se revisa y se prueba en el mismo PR, con un test que compara los
    selectores permitidos con el ABI compilado.
  - Con varios repositorios, ese desajuste solo aparecería en producción.
- **Un único CI y un único lockfile:** la regla de `pnpm audit --prod`
  antes de desplegar ([AGENTS.md](../../AGENTS.md#reglas-de-trabajo)) sigue
  siendo una sola comprobación.
- **Tamaño del proyecto:** con una persona responsable, varios repositorios
  multiplican versiones, permisos y PR sin aislar más. El aislamiento lo dan
  los procesos, las imágenes y los secretos, no los repositorios.

**Cuándo reconsiderarlo:**

- **Auditoría externa de los contratos:** se audita un commit etiquetado de
  `packages/contracts`. Si el auditor pide un repositorio aislado, se
  extrae con `git subtree split` conservando el historial, sin separar el
  desarrollo antes.
- **Equipos o permisos distintos:** por ejemplo, que la administración
  convocante mantenga el servicio de identidad.
- **Licencias distintas por componente,** si se decide así (ver abajo).
- **Ritmos de publicación incompatibles:** por ejemplo, contratos
  congelados durante una votación real mientras la web sigue cambiando.

### Licencia (recomendación; decide el responsable)

Situación actual:

- El repositorio es **público, pero no tiene archivo `LICENSE`** ni campo
  `license` en ningún `package.json`. Por defecto, eso significa «todos los
  derechos reservados».
- `VotacionAnonima.sol` declara `SPDX-License-Identifier: GPL-3.0-only`.
- Las interfaces de ZKPassport que incluye son Apache-2.0.

Opciones:

| Opción | Qué implica |
|---|---|
| **A. AGPL-3.0-or-later en todo el repositorio** (recomendada) | Permite reutilizar código del `gateway` (AGPL-3.0) y del resto de spain-in-parallel (GPL-3.0). Quien ofrezca una versión modificada como servicio en red debe publicar su código. Encaja con un sistema de voto, cuya confianza depende de que el código sea auditable. `VotacionAnonima.sol` puede seguir en GPL-3.0: GPL y AGPL 3.0 se pueden combinar por su sección 13 |
| B. GPL-3.0 en todo el repositorio | Coherente con el contrato actual. Permite reutilizar `registry`, `deployed-contracts`, `council-dao` y `app`, **pero no código del `gateway`**. Quien modifique la web y la sirva no está obligado a publicar sus cambios |
| C. Sin reutilizar código y licencia libre a elegir | Diseños inspirados sin copiar código (lo que proponen este ADR y el 0016). Libertad total, pero hay que escribirlo todo |

- **Recomendación:** A. Si se reutiliza código del gateway, Civora pasa
  obligatoriamente a AGPL-3.0, y en todo caso conviene añadir ya un
  `LICENSE`.
- **En esta tarea no se copia código** de spain-in-parallel. El relayer
  propuesto se escribe desde cero con el diseño descrito, así que la
  decisión de licencia no bloquea la implementación.
- Antes de cambiar de licencia hay que revisar las licencias de las
  dependencias de runtime, por ejemplo con `pnpm licenses list --prod`.

## Alternativas

- **Seguir con un solo proceso:**
  - Es lo más sencillo y ahorra memoria.
  - Pero un fallo de la web expone todas las claves.
- **Solo extraer el relayer:**
  - Es el primer paso del plan y el de mejor coste/beneficio.
  - Pero deja `NULLIFIER_CERTIFICADO_SECRET` en la web y la web sigue
    viendo los certificados.
- **Usar el `gateway` tal cual:**
  - Su API es la de Rarimo (`/integrations/...`) y combina relayer y
    *registrator* en un proceso.
  - No autentica a quien llama.
  - Su *registrator* verifica documentos que Civora no usa hoy (ZKPassport
    verifica dentro del contrato) y depende de `node-forge`.
- **Varios repositorios:** descartado ahora (ver
  [Por qué monorepo](#por-qué-monorepo)).
- **Gestor de secretos o HSM para la clave del relayer:** mejora la
  custodia, pero no evita que un proceso comprometido pida firmas. Se
  reconsidera para producción, en el VPS dedicado.

## Consecuencias

- Hay tres imágenes y tres servicios que mantener, actualizar y supervisar,
  y el despliegue tiene un orden.
- La web deja de necesitar la clave del relayer y los secretos de
  identidad. Los tests lo comprueban.
- La tabla de variables de
  [despliegue-produccion.md](../despliegue-produccion.md) se divide por
  servicio. [despliegue-vps.md](../despliegue-vps.md) pasa de «un solo
  servicio» a cuatro.
- M-02 mejora en custodia: la clave sale del proceso expuesto. No mejora en
  correlación de metadatos.
- El tope de gasto del relayer, pendiente para producción, se implementa en
  el servicio `relayer`.

## Criterios de aceptación

- **Por pasos**, en este orden ([ROADMAP](../ROADMAP.md)):
  1. `relayer` extraído.
  2. `RegistroIdeas` ([ADR 0016](0016-propuestas-registro-ideas-multifirma-ipfs.md)).
  3. `identidad` extraído.
- **Relayer:**
  - Rechaza destinos y selectores fuera de la lista y clientes sin firma
    válida o con firma caducada.
  - Rechaza `votarManual` si no viene de `identidad`, una llamada que
    revierte en `estimateGas`, una que supera el tope de gas y una que
    supera el gasto diario.
  - Un test compara los selectores permitidos con el ABI compilado.
- **Secretos:**
  - `HARDHAT_RELAYER_PRIVATE_KEY` no aparece en `apps/web`, ni en el código
    ni en la imagen. `NULLIFIER_CERTIFICADO_SECRET` y
    `RETO_CERTIFICADO_SECRET` solo están en `apps/identidad`.
  - Lo comprueban un test y el job de imágenes.
- **Red:** `civora-relayer` no responde desde fuera del VPS (comprobado
  desde fuera) y sí desde la web.
- **Funcionamiento:**
  - `test:e2e` sigue en verde con los tres servicios simulados.
  - El voto con certificado real y el voto ZK con pasaporte simulado
    funcionan en la demo tras desplegar.
- **Operación:** memoria medida con `docker stats`, límites fijados en
  Easypanel y apuntados en [despliegue-vps.md](../despliegue-vps.md).

## Decisiones pendientes del responsable

1. Licencia: A (AGPL-3.0-or-later), B (GPL-3.0) o C (sin reutilizar
   código), y añadir `LICENSE` en cualquier caso.
2. Ruta (`/identidad/*`) o subdominio para el servicio de identidad,
   según lo que permita Easypanel.
3. Tope de gasto diario del relayer y saldo máximo de la cuenta en la demo.
