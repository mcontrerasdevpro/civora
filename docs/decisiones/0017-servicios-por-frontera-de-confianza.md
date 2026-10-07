# 0017. Separación en servicios por frontera de confianza, en monorepo

- **Estado:** aceptada (diseño; sin implementar). Decisiones del responsable del 2026-10-07 incorporadas ([al final](#decisiones-del-responsable-2026-10-07))
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
| `web` (`apps/web`) | Páginas, lectura de la cadena y de IPFS, caché en Postgres, entrada de votos ZK y de propuestas | `DATABASE_URL` (rol de Postgres limitado a sus tablas), RPC de solo lectura, `TOKEN_RELAYER_WEB`, credenciales de escritura de Pinata y Filebase ([ADR 0016](0016-propuestas-registro-ideas-multifirma-ipfs.md#3-ipfs)) | Sí, en el dominio de `WEB_ORIGEN` |
| `relayer` (`apps/relayer`) | Única clave que paga gas; retransmite solo llamadas de la lista blanca | `HARDHAT_RELAYER_PRIVATE_KEY`, RPC de envío, `TOKEN_RELAYER_WEB` y `TOKEN_RELAYER_IDENTIDAD` (para verificar) | **No, en ningún entorno.** Sin dominio ni puerto publicado; solo red interna |
| `identidad` (`apps/identidad`) | Reto y verificación del certificado (CMS, cadena FNMT/DGP, OCSP), cálculo del nullifier de certificado y, con el ADR 0016, cupo de propuestas por persona | `NULLIFIER_CERTIFICADO_SECRET`, `RETO_CERTIFICADO_SECRET`, `FALLO_ABIERTO_REVOCACION`, `TOKEN_RELAYER_IDENTIDAD` | Sí, en **su propio subdominio** (`IDENTIDAD_ORIGEN`; ver abajo) |

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

  - Además: `estimateGas` previo y tope de gas por transacción.
  - **Tope de gasto diario de 10 € con alerta al 50 %**, y 20 ideas al día
    sin cartera.
    - Los valores se leen de variables de entorno: se cambian sin
      reconstruir la imagen
      ([ADR 0016](0016-propuestas-registro-ideas-multifirma-ipfs.md#4-quién-paga-qué)).
    - Al llegar al 100 % rechaza transacciones hasta el día siguiente
      (UTC).
  - Una sola instancia gestiona el *nonce*, y el saldo de la cuenta se
    mantiene bajo y se recarga a mano.
  - La lista blanca se genera con el ABI compilado del mismo commit (ver
    [Por qué monorepo](#por-qué-monorepo)).
- **Flujo de certificado:** el navegador habla con `identidad` **en su
  propio subdominio**, sin pasar por la web.
  - **Dominios por configuración, nunca fijos en el código:**
    - `WEB_ORIGEN` y `IDENTIDAD_ORIGEN` en `identidad`, para el CORS.
    - `NEXT_PUBLIC_IDENTIDAD_ORIGEN` en la web, como *build arg*, para
      `fetch` y la CSP.

    | Entorno | Web | Identidad |
    |---|---|---|
    | Entorno de pruebas actual | `civora.nexuraia.com` | `identidad.civora.nexuraia.com` |
    | Producción en VPS dedicado | dominio definitivo, por decidir | `identidad.<dominio definitivo>` |

  - **CORS:** `identidad` solo acepta el origen exacto de `WEB_ORIGEN`, sin
    credenciales ni cookies. Responde con
    `Access-Control-Allow-Origin` fijo y sin comodines.
  - **CSP:** la web añade `IDENTIDAD_ORIGEN` a `connect-src` y nada más; el
    resto de la política del [ADR 0007](0007-csp-con-nonce.md) no cambia.
    `identidad` sirve solo JSON, con `default-src 'none'`.
  - Así **la web deja de ver el certificado**.
  - No cambia A-01: `identidad` sigue recibiendo certificado y opción a la
    vez hasta la Fase 1.
  - El flujo de ZKPassport no cambia: la prueba se pide desde la web y su
    dominio sigue siendo el que fija el contrato (`dominioZk`).
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
- **Despliegue:** las variables de cada servicio solo incluyen sus secretos.
  El orden es `relayer` → `identidad` → `web`. Ningún dominio está fijo en
  el código ni en las imágenes.
- **Memoria estimada:**

  | Servicio | Memoria estimada |
  |---|---|
  | `web` | 200-300 MB |
  | `relayer` | 60-100 MB |
  | `identidad` | 80-120 MB |
  | Postgres | 50-150 MB |
  | Kubo (solo en producción) | 300-500 MB |

  Son estimaciones: hay que medirlas con `docker stats`.

### Entornos

| Aspecto | Entorno de pruebas actual | Producción en VPS dedicado |
|---|---|---|
| Servidor | VPS KVM 2 (8 GB) **compartido con el n8n de producción**, Easypanel, proyecto `nexuraia` | VPS **exclusivo para Civora**, endurecido y supervisado |
| Dominio | `civora.nexuraia.com` e `identidad.civora.nexuraia.com` | Dominio propio definitivo y su subdominio de identidad, por configuración |
| Servicios | `civora`, `civora-relayer` (sin dominio), `civora-identidad` y `civora-db` | Los mismos más `ipfs` (Kubo), en su propia red interna |
| Aislamiento | Solo por contenedores y red interna de Docker. Un fallo de Easypanel o de otro servicio del VPS puede afectar a Civora, y al revés ([ADR 0011](0011-alojamiento-vps-propio.md)). **Límite de memoria por servicio** obligatorio, para no dejar sin memoria a n8n | Servidor dedicado; cortafuegos que solo abre 443 (y 4001 para Kubo); panel de administración sin exposición pública |
| Autenticación entre servicios | HMAC por cliente | HMAC por cliente; se reconsidera mTLS |
| Postgres | `civora-db`, sin copias de seguridad, `sslmode=disable` en la red interna ([ADR 0013](0013-postgres-en-el-vps.md)) | Copias de seguridad automáticas y probadas, TLS o red aislada; solo caché ([ADR 0016](0016-propuestas-registro-ideas-multifirma-ipfs.md)) |
| IPFS | Pinata y Filebase | Pinata, Filebase y Kubo propio como tercera copia |
| Clave del relayer | Variable de entorno de Easypanel | Variable de entorno; se valora un gestor de secretos (ver [Alternativas](#alternativas)) |

El paso de un entorno a otro va unido al paso a Base y al redespliegue de
los contratos con el dominio definitivo. `dominioZk` se fija en el contrato
al desplegarlo, así que cambiar de dominio obliga a redesplegar igualmente
([ROADMAP](../ROADMAP.md#servicios-propuestas-y-red-principal)).

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

### Licencia

**Decidido el 2026-10-07: AGPL-3.0-or-later en todo el repositorio**
([ADR 0018](0018-licencia-agpl.md)). Se conserva el análisis que llevó a
la decisión:

Situación antes de la decisión:

- El repositorio era **público, pero no tiene archivo `LICENSE`** ni campo
  `license` en ningún `package.json`. Por defecto, eso significaba «todos los
  derechos reservados».
- `VotacionAnonima.sol` declaraba `SPDX-License-Identifier: GPL-3.0-only`.
- Las interfaces de ZKPassport que incluye son Apache-2.0.

Opciones:

| Opción | Qué implica |
|---|---|
| **A. AGPL-3.0-or-later en todo el repositorio** (recomendada) | Permite reutilizar código del `gateway` (AGPL-3.0) y del resto de spain-in-parallel (GPL-3.0). Quien ofrezca una versión modificada como servicio en red debe publicar su código. Encaja con un sistema de voto, cuya confianza depende de que el código sea auditable. `VotacionAnonima.sol` puede seguir en GPL-3.0: GPL y AGPL 3.0 se pueden combinar por su sección 13 |
| B. GPL-3.0 en todo el repositorio | Coherente con el contrato actual. Permite reutilizar `registry`, `deployed-contracts`, `council-dao` y `app`, **pero no código del `gateway`**. Quien modifique la web y la sirva no está obligado a publicar sus cambios |
| C. Sin reutilizar código y licencia libre a elegir | Diseños inspirados sin copiar código (lo que proponen este ADR y el 0016). Libertad total, pero hay que escribirlo todo |

- **Elegida: A**, con `LICENSE` y cabeceras SPDX unificadas
  ([ADR 0018](0018-licencia-agpl.md)).
- **Matiz que añade el ADR 0018:** el titular se reserva ofrecer licencias
  comerciales aparte. El código de terceros con *copyleft* (por ejemplo,
  del `gateway`) se puede reutilizar bajo la AGPL, pero no se puede
  incluir en una licencia comercial sin permiso de sus autores.
- **En esta tarea no se copia código** de spain-in-parallel. El relayer
  propuesto se escribe desde cero con el diseño descrito, así que la
  decisión de licencia no bloquea la implementación.
- La revisión de las licencias de las dependencias de runtime está en el
  [ADR 0018](0018-licencia-agpl.md#dependencias).

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

## Decisiones del responsable (2026-10-07)

1. **Licencia:** AGPL-3.0-or-later en todo el repositorio
   ([ADR 0018](0018-licencia-agpl.md)).
2. **Identidad:** en su propio subdominio (`identidad.<dominio>`, por
   configuración). El relayer no tiene dominio público en ningún entorno:
   solo red interna.
3. **Topes del relayer:** 10 € al día con alerta al 50 % y 20 ideas al día
   sin cartera, configurables sin reconstruir la imagen.
4. **Entornos:** `civora.nexuraia.com` y el VPS compartido son el entorno
   de pruebas. La producción irá en un VPS exclusivo con dominio propio
   ([Entornos](#entornos)).
