# Despliegue a producción

Procedimiento, independiente de la plataforma, para llevar a `main` la
cadena de ramas `fase-0-seguridad` → `accesibilidad-voto-asistido` →
`docs-organizacion` → `preparar-produccion` → `correcciones-revision` →
`despliegue-vps` → `actualizar-dependencias`. Son lineales sobre `main`: se
integran con **una sola PR desde la última** (PR #5).

La web se aloja en un VPS propio con Easypanel, en `civora.nexuraia.com`,
con **un solo servicio** ([ADR 0011](decisiones/0011-alojamiento-vps-propio.md)).
Los pasos propios de Easypanel (DNS, servicio, build args, healthcheck) están
en [despliegue-vps.md](despliegue-vps.md). Vercel está desconectado de GitHub
y ya no despliega.

Objetivo: demo pública en Sepolia con las protecciones de la Fase 0, de la
revisión externa y de las dependencias, y con **pruebas ZKPassport reales**
(`devMode` desactivado en el contrato y en la web). La excepción de demo con
pruebas simuladas ([ADR 0010](decisiones/0010-demo-publica-testnet.md)) no se
usa.

> **Por qué hace falta un contrato nuevo:** cambian el constructor (relayer
> inmutable y rechazo de la dirección cero), los nullifiers de certificado
> (R-02) y el dominio ZK (`civora.nexuraia.com`). La web nueva no funciona
> con el contrato antiguo ni al revés.

Orden: [1](#1-desplegar-el-contrato-nuevo-en-sepolia) →
[2](#2-variables-de-la-web) →
[3](#3-comprobar-el-servicio-antes-de-fusionar) →
[4](#4-fusionar) → [5](#5-volver-atrás-si-algo-falla).

## Contrato desplegado

Desplegado y verificado con `verificar:sepolia` el 2026-10-07 desde la rama
`feat/r01-opcion-en-prueba-zk` (R-01: la opción va vinculada a la prueba ZK,
[ADR 0014](decisiones/0014-opcion-vinculada-prueba-zk.md)):

| Dato | Valor |
|---|---|
| Red | Sepolia (chainId 11155111) |
| `CONTRATO_DIRECCION` | `0x628901F7bC5Ab55c8b6289a05F0AD543DA94Bdb7` |
| Contrato anterior (sin R-01, retirado) | `0xDCfe657B6699c684C0bB841f88a08Fd3390cFC3C` |
| **Contrato de demostración** (en uso; `devModeZk=true`, `CIVORA_DEMO_TESTNET=true`, [ADR 0010](decisiones/0010-demo-publica-testnet.md)) | `0xe5B87219E2dda01c61f8491Cc6AcEd5dD85C1Ed6` |
| Dominio ZK (`dominioZk`) | `civora.nexuraia.com` |
| `devModeZk` | `false` (solo pruebas ZKPassport reales) |
| Relayer inmutable | `0x9bC3679F634Ea86bA0353e4c70BBf7FEdA025be6` |

**Por qué la demo usa el contrato de demostración:** el registro de
certificados de ZKPassport en Sepolia solo contiene los de los pasaportes
simulados; la raíz de mainnet (la de los documentos reales) no es válida en
Sepolia, y en Base sí. Con `devModeZk=false` en Sepolia, la vía ZK no
funciona con ningún documento. Para la demo, el servicio usa el contrato de
demostración con `CONTRATO_DIRECCION=0xe5B8…1Ed6`,
`NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=true` (build) y `CIVORA_DEMO_TESTNET=true`;
la web muestra el banner «MODO DEMOSTRACIÓN» y avisa en la vía DNIe. Las
pruebas simuladas tienen todas el identificador `1`: un solo voto simulado
por propuesta.

El relayer es la dirección pública de `HARDHAT_RELAYER_PRIVATE_KEY`: la clave
que se configure en el servicio debe corresponder a esa dirección. Para
cambiar el relayer, el dominio, `devMode` o `NULLIFIER_CERTIFICADO_SECRET`
hay que desplegar otro contrato y actualizar esta tabla.

## 1. Desplegar el contrato nuevo en Sepolia

Desde la raíz, en PowerShell, **con la rama que se va a fusionar**. Las
variables van en `packages/contracts/.env` (no se versiona) o en la sesión;
**nunca** en archivos versionados.

### 1.1 Obtener la dirección pública del relayer

`RELAYER_ADDRESS` debe ser la dirección de `HARDHAT_RELAYER_PRIVATE_KEY`, la
clave con la que la web firma y paga el gas. Para obtenerla sin imprimir la
clave:

```powershell
$env:CLAVE = Read-Host "Clave del relayer" -MaskInput   # PowerShell 7; en 5.1 usa -AsSecureString
pnpm --filter web exec node -e "console.log(new (require('ethers').Wallet)(process.env.CLAVE).address)"
Remove-Item Env:CLAVE
```

### 1.2 Variables del despliegue

| Variable | Valor | Cambio respecto a `main` |
|---|---|---|
| `SEPOLIA_RPC_URL` | URL RPC de Sepolia (Alchemy, Infura…) | sin cambios |
| `SEPOLIA_PRIVATE_KEY` | clave de la cuenta que despliega, con ETH de Sepolia | sin cambios |
| `RELAYER_ADDRESS` | dirección del paso 1.1 | **nueva** (obligatoria en redes públicas) |
| `ZKPASSPORT_DOMAIN` | `civora.nexuraia.com` | **modificada**: dominio nuevo; debe coincidir con `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` |
| `ZKPASSPORT_DEV_MODE` | `false` | **modificada**: antes `true` por defecto; ahora `false` explícito |
| `CIVORA_DEMO_TESTNET` | sin definir | solo para la demo con pruebas simuladas ([ADR 0010](decisiones/0010-demo-publica-testnet.md)), que no se usa |

### 1.3 Desplegar

```powershell
pnpm --filter @civora/contracts deploy:sepolia
```

El script imprime la dirección del contrato, el relayer, el dominio y el
`devMode`. Fallará si el dominio es el de demo, si `ZKPASSPORT_DEV_MODE` no
es `false` explícito o si falta `RELAYER_ADDRESS`.

### 1.4 Verificar el contrato desplegado

```powershell
$env:CONTRATO_DIRECCION = "0x…"   # dirección impresa en 1.3
pnpm --filter @civora/contracts verificar:sepolia
```

El script lee del contrato `relayer()`, `dominioZk()` y `devModeZk()` y los
compara con `RELAYER_ADDRESS`, `ZKPASSPORT_DOMAIN` y `ZKPASSPORT_DEV_MODE`.
Debe terminar con `OK: el contrato coincide con la configuración esperada.`
Si el relayer no coincide, **no sigas**: la web no podría crear propuestas
ni registrar votos de certificado. Despliega otro contrato con la dirección
correcta. Anota el resultado en [Contrato desplegado](#contrato-desplegado).

## 2. Variables de la web

Se definen en el servicio `civora` de Easypanel
([despliegue-vps.md](despliegue-vps.md#4-configuración-del-servicio)). La
columna «Se lee» indica si la variable se usa al construir la imagen (build
arg) o al ejecutarla; las de build obligan a reconstruir tras cambiarlas.

| Variable | Obligatoria | Valor (sin secretos) | Se lee | Cambio respecto a `main` |
|---|---|---|---|---|
| `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` | sí | `civora.nexuraia.com` (igual que `dominioZk` del contrato) | build arg (y queda en la imagen) | **modificada**: dominio nuevo |
| `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` | sí | `false` (igual que `devModeZk` del contrato) | build arg (y queda en la imagen) | **modificada**: antes `true` por defecto; ahora `false` explícito |
| `CONTRATO_DIRECCION` | sí | `0xDCfe657B6699c684C0bB841f88a08Fd3390cFC3C` | ejecución | **modificada**: contrato nuevo |
| `HARDHAT_RPC_URL` | sí | `https://eth-sepolia.g.alchemy.com/v2/<clave>` | ejecución | sin cambios |
| `HARDHAT_RELAYER_PRIVATE_KEY` | sí | clave cuya dirección es `0x9bC3679F634Ea86bA0353e4c70BBf7FEdA025be6` | ejecución | sin cambios, salvo que se rote (exige otro contrato) |
| `DATABASE_URL` | sí | `postgresql://postgres:<contraseña>@nexuraia_civora-db:5432/civora?sslmode=disable` ([despliegue-vps.md](despliegue-vps.md#base-de-datos-civora-db)) | ejecución | **modificada**: Postgres en el VPS ([ADR 0013](decisiones/0013-postgres-en-el-vps.md)) |
| `ADMIN_SECRET` | no | sin definir | — | **retirada**: la creación de propuestas es abierta en la demo ([auditoría, M-04](auditoria-seguridad.md#m-04--medio--creación-de-propuestas-sin-autorización-riesgo-aceptado-en-la-demo)); bórrala de Easypanel |
| `RETO_CERTIFICADO_SECRET` | sí, para la vía de certificado | cadena aleatoria larga | ejecución | sin cambios; ahora el reto incluye la opción (R-04) |
| `NULLIFIER_CERTIFICADO_SECRET` | sí; sin ella el contenedor no arranca con RPC no local | 32 caracteres o más (p. ej. `openssl rand -hex 32`) | ejecución | **nueva** (R-02) |
| `FALLO_ABIERTO_REVOCACION` | no | `false` o sin definir | ejecución | **modificada**: `true` ya no se permite fuera de local; el contenedor no arranca |
| `CIVORA_DEMO_TESTNET` | no | sin definir | ejecución | solo para la demo con pruebas simuladas, que no se usa |
| `EXPLORADOR_URL` | no | explorador de bloques de la red del contrato, solo `https` (en Sepolia, el de Etherscan para Sepolia) | ejecución | **nueva**: sin ella, `/resultados/<id>` muestra las transacciones sin enlace |
| `RPC_MAX_BLOQUES_LOGS` | no | `10` (límite de `eth_getLogs` del plan gratuito de Alchemy) | ejecución | **nueva**: bloques por consulta del indexador de eventos ([ADR 0020](decisiones/0020-indice-incremental-eventos.md)) |
| `CONTRATO_BLOQUE_DESPLIEGUE` | recomendada | número del bloque en que se desplegó `CONTRATO_DIRECCION`, en decimal (lo muestra el explorador; para el contrato de demostración actual, `11862164`). No es la dirección | ejecución | **nueva**: desde dónde empieza el indexador; sin ella, o con un valor que no sea un entero decimal, lo busca en la cadena con más consultas y lo avisa en el registro |
| `INDEXADOR_EVENTOS` | no | sin definir (activo si hay `DATABASE_URL`); `false` lo desactiva | ejecución | **nueva** |
| `INDEXADOR_INTERVALO_S` | no | `30` | ejecución | **nueva**: segundos entre ciclos cuando el índice está al día |
| `INDEXADOR_CONSULTAS_POR_CICLO` | no | `100` | ejecución | **nueva**: consultas `eth_getLogs` por ciclo |
| `INDEXADOR_PAUSA_MS` | no | `200` | ejecución | **nueva**: pausa entre consultas, para no superar el ritmo del proveedor |

`NODE_ENV`, `PORT` y `HOSTNAME` los fija la imagen; no los definas. **Ningún
secreto debe declararse como `ARG` en el Dockerfile**: Easypanel pasa todas
las variables como build args, pero solo las declaradas con `ARG` llegan a
la imagen, y hoy son únicamente las dos `NEXT_PUBLIC_*`.

**`NULLIFIER_CERTIFICADO_SECRET` es parte del contrato.** Cada nullifier de
certificado se calcula con ella, así que no puede cambiar mientras se use
este contrato: con otro valor, la misma persona obtendría otro nullifier y
podría votar dos veces. **Guárdala también fuera de Easypanel** (gestor de
secretos o de contraseñas). Perderla obliga a desplegar un contrato nuevo,
igual que rotarla ([ADR 0005](decisiones/0005-no-publicar-nif.md)).

Consecuencias de datos: las propuestas guardadas en la base de datos que
apuntan al contrato antiguo no existen en el nuevo y quedan huérfanas. Siguen
apareciendo en el listado; sus resultados se muestran como «no disponibles»
y el contrato rechaza cualquier voto sobre ellas. Por eso la demo empieza con
una base de datos vacía en el VPS.

## 3. Comprobar el servicio antes de fusionar

Con el servicio `civora` apuntando a la rama de la PR
([despliegue-vps.md](despliegue-vps.md#3-un-solo-servicio)), comprueba cada
punto en `https://civora.nexuraia.com`. No fusiones si alguno falla. Al no
haber entorno de pruebas separado, lo que se cree aquí (propuestas y votos)
queda en el contrato y la base de datos de la demo.

| # | Comprobación | Resultado esperado |
|---|---|---|
| 1 | `curl.exe -fsS https://civora.nexuraia.com/api/salud` | `{"estado":"ok"}`; el contenedor figura como `healthy` |
| 2 | Crear propuesta en `/propuestas/nueva` (sin clave), cierre en unos 15 minutos | Se crea y aparece en `/propuestas`. Tras 5 creaciones desde la misma IP en 15 minutos, bloqueo temporal |
| 3 | Votar con certificado digital (Autofirma + certificado FNMT o DNIe) | La confirmación avisa de que se abrirá Autofirma; la firma se pide al pulsar «Sí»; recibo. Un segundo voto con el mismo certificado se rechaza |
| 4 | Flujo ZK con la app ZKPassport y un DNIe o pasaporte real (NFC) | El QR aparece, la prueba real se acepta y se obtiene recibo |
| 5 | Sin banner | **MODO DEMOSTRACIÓN** no aparece (`devMode` desactivado) |
| 6 | CSP: `curl.exe -sI https://civora.nexuraia.com/votar` | `content-security-policy` con `nonce-…`, `strict-dynamic` y `media-src 'self'`, **sin** `unsafe-eval`; `referrer-policy: no-referrer`; sin `x-powered-by` |
| 6b | Abrir en el navegador `/`, `/propuestas`, `/propuestas/nueva`, `/verificar`, `/resultados`, `/votar`, `/votar/<id>` y `/resultados/<id>` | Ningún error de CSP en la consola en ninguna; `/propuestas` muestra el listado y `/verificar` responde al pulsar «Comprobar» |
| 7 | Modo sencillo en `/votar/<id>` | El interruptor se recuerda al recargar; letra grande; sin palabras técnicas; confirmación «Va a votar: X. ¿Es correcto?» |
| 8 | Audios | En la confirmación, «Escuchar» reproduce `/audio/confirmacion/<opción>.wav` (200, `audio/wav`) |
| 9 | Resultados ocultos hasta el cierre | Antes del cierre, `/resultados/<id>` y la API no muestran recuentos; tras el cierre, sí y coinciden con los votos emitidos |
| 10 | Registros del contenedor | Ni IPs, ni cuerpos de petición, ni firmas, certificados o nullifiers; solo líneas `[civora] contexto: CÓDIGO` |
| 11 | CI de la PR | Jobs «Tests, typecheck, build y E2E» e «Imagen Docker» en verde (checks obligatorios en `main`) |
| 12 | `pnpm audit --prod` en la rama | `No known vulnerabilities found` |

## 4. Fusionar

Solo con confirmación explícita del responsable.

1. Anota la configuración del servicio (variables y commit desplegado) para
   el [paso 5](#5-volver-atrás-si-algo-falla).
2. Fusiona la PR. Los checks obligatorios de `main` impiden hacerlo sin el
   CI en verde.
3. En el servicio `civora`, cambia la rama de *Source* a `main` y despliega.
4. Repite las comprobaciones 1, 2, 5, 6, 6b, 9 y 10 del paso 3.
5. Activa *Auto Deploy* para `main` si quieres despliegues en cada push.

## 5. Volver atrás si algo falla

1. **Inmediato:** vuelve a la versión anterior según
   [despliegue-vps.md](despliegue-vps.md#7-volver-atrás).
2. **Restaurar variables** a los valores anotados en el paso 4.1.
   - No borres `NULLIFIER_CERTIFICADO_SECRET`: el contrato la necesita
     mientras siga en uso.
3. **Revertir el merge en `main`:** en la PR fusionada, *Revert* → crea una
   PR de reversión → fusiónala. O en local, en una rama:
   `git revert -m 1 <commit-de-merge>` y PR.
4. El contrato de Sepolia puede quedarse sin uso; no hace falta destruirlo.
