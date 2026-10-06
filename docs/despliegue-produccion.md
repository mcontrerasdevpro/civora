# Despliegue a producción

Procedimiento, independiente de la plataforma, para llevar a `main` la
cadena de ramas `fase-0-seguridad` → `accesibilidad-voto-asistido` →
`docs-organizacion` → `preparar-produccion` → `correcciones-revision` →
`despliegue-vps`. Son lineales sobre `main`: se integran con **una sola PR
desde la última**.

La web se aloja en un VPS propio con Easypanel, en `civora.nexuraia.com`
([ADR 0011](decisiones/0011-alojamiento-vps-propio.md)). Los pasos propios de
Easypanel (DNS, servicio, build args, healthcheck) están en
[despliegue-vps.md](despliegue-vps.md). Hasta completar la migración, la
versión anterior sigue en Vercel.

Objetivo: mantener la demo pública en Sepolia (modo demo de ZKPassport y
banner) con las protecciones de la Fase 0 y de la revisión externa. Decisión
y límites de la demo: [ADR 0010](decisiones/0010-demo-publica-testnet.md).

> **Por qué hace falta un contrato nuevo:** cambian el constructor (relayer
> inmutable y rechazo de la dirección cero), los nullifiers de certificado
> (R-02) y el dominio ZK (`civora.nexuraia.com`). La web nueva no funciona
> con el contrato antiguo ni al revés.

Orden: [1](#1-desplegar-el-contrato-nuevo-en-sepolia) →
[2](#2-variables-de-la-web) →
[3](#3-comprobar-el-servicio-de-pruebas-antes-de-fusionar) →
[4](#4-fusionar) → [5](#5-volver-atrás-si-algo-falla).

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
| `CIVORA_DEMO_TESTNET` | `true` | **nueva**: opt-in de demo, solo válida en Sepolia |
| `ZKPASSPORT_DEV_MODE` | `true` | **modificada**: antes era `true` por defecto; ahora debe ser explícita |
| `ZKPASSPORT_DOMAIN` | `civora.nexuraia.com` | **modificada**: dominio nuevo; debe coincidir con `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` |

### 1.3 Desplegar

```powershell
pnpm --filter @civora/contracts deploy:sepolia
```

El script imprime la dirección del contrato, el relayer, el dominio, el
`devMode` y el aviso `AVISO: demo pública en Sepolia`. Fallará si
`CIVORA_DEMO_TESTNET=true` apunta a otra red, si falta `RELAYER_ADDRESS` o si
`ZKPASSPORT_DEV_MODE` no es explícita.

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
correcta.

## 2. Variables de la web

Se definen en el servicio de Easypanel
([despliegue-vps.md](despliegue-vps.md#4-servicio-en-easypanel)). La columna
«Se lee» indica si la variable se usa al construir la imagen (build arg) o al
ejecutarla; las de build obligan a reconstruir tras cambiarlas.

| Variable | Obligatoria | Valor de ejemplo (sin secretos) | Se lee | Cambio respecto a `main` |
|---|---|---|---|---|
| `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` | sí | `civora.nexuraia.com` (igual que `ZKPASSPORT_DOMAIN` del contrato) | build arg (y queda en la imagen) | **modificada**: dominio nuevo |
| `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` | sí | `true` | build arg (y queda en la imagen) | **modificada**: antes `true` por defecto; ahora explícita |
| `CIVORA_DEMO_TESTNET` | sí, para la demo | `true` | ejecución | **nueva**: sin ella el contenedor no arranca con `DEV_MODE=true` |
| `CONTRATO_DIRECCION` | sí | `0x…` del paso 1.3 | ejecución | **modificada**: contrato nuevo |
| `HARDHAT_RPC_URL` | sí | `https://eth-sepolia.g.alchemy.com/v2/<clave>` | ejecución | sin cambios |
| `HARDHAT_RELAYER_PRIVATE_KEY` | sí | clave cuya dirección es `RELAYER_ADDRESS` | ejecución | sin cambios, salvo que se rote (exige otro contrato) |
| `DATABASE_URL` | sí | `postgresql://usuario:<contraseña>@host-pooler.neon.tech/neondb?sslmode=require` | ejecución | sin cambios; usa otra base de datos (o rama de Neon) para el servicio de pruebas |
| `ADMIN_SECRET` | sí, para crear propuestas | cadena aleatoria larga | ejecución | **nueva** (Fase 0) |
| `RETO_CERTIFICADO_SECRET` | sí, para la vía de certificado | cadena aleatoria larga | ejecución | sin cambios; ahora el reto incluye la opción (R-04) |
| `NULLIFIER_CERTIFICADO_SECRET` | sí; sin ella el contenedor no arranca con RPC no local | 32 caracteres o más (p. ej. `openssl rand -hex 32`) | ejecución | **nueva** (R-02) |
| `FALLO_ABIERTO_REVOCACION` | no | `false` o sin definir | ejecución | **modificada**: `true` ya no se permite fuera de local; el contenedor no arranca |

`NODE_ENV`, `PORT` y `HOSTNAME` los fija la imagen; no los definas. **Ningún
secreto debe declararse como `ARG` en el Dockerfile**: Easypanel pasa todas
las variables como build args, pero solo las declaradas con `ARG` llegan a
la imagen, y hoy son únicamente las dos `NEXT_PUBLIC_*`.

**`NULLIFIER_CERTIFICADO_SECRET` es parte del contrato.** Cada nullifier de
certificado se calcula con ella, así que debe ser la misma en todos los
servicios que usen el mismo contrato y no puede cambiar durante su vida: con
otro valor, la misma persona obtendría otro nullifier y podría votar dos
veces. **Guárdala también fuera de Easypanel** (gestor de secretos o de
contraseñas). Perderla obliga a desplegar un contrato nuevo, igual que
rotarla ([ADR 0005](decisiones/0005-no-publicar-nif.md)).

Consecuencias de datos: las propuestas guardadas en la base de datos que
apuntan al contrato antiguo no existen en el nuevo y quedan huérfanas. Si el
servicio de pruebas comparte `DATABASE_URL` con producción, sus propuestas
aparecerán en producción.

## 3. Comprobar el servicio de pruebas antes de fusionar

Crea el servicio de pruebas de Easypanel desde la rama de la PR
([despliegue-vps.md](despliegue-vps.md#3-servicio-de-pruebas-y-servicio-de-producción))
y comprueba cada punto. No fusiones si alguno falla.

| # | Comprobación | Resultado esperado |
|---|---|---|
| 1 | `curl.exe -fsS https://<dominio>/api/salud` | `{"estado":"ok"}`; el contenedor figura como `healthy` |
| 2 | Crear propuesta en `/propuestas/nueva` con `ADMIN_SECRET`, cierre en unos 15 minutos | Se crea y aparece en `/propuestas`. Con una clave incorrecta, error; tras 5 intentos, bloqueo temporal |
| 3 | Votar con certificado digital (Autofirma + certificado FNMT o DNIe) | La confirmación avisa de que se abrirá Autofirma; la firma se pide al pulsar «Sí»; recibo. Un segundo voto con el mismo certificado se rechaza |
| 4 | Flujo ZK en modo demo con la app ZKPassport (documento de prueba) | El QR aparece, la prueba se acepta y se obtiene recibo |
| 5 | Banner | **MODO DEMOSTRACIÓN** visible en todas las páginas |
| 6 | CSP: `curl.exe -sI https://<dominio>/votar` | `content-security-policy` con `nonce-…`, `strict-dynamic` y `media-src 'self'`, **sin** `unsafe-eval`; ningún error de CSP en la consola del navegador |
| 7 | Modo sencillo en `/votar/<id>` | El interruptor se recuerda al recargar; letra grande; sin palabras técnicas; confirmación «Va a votar: X. ¿Es correcto?» |
| 8 | Audios | En la confirmación, «Escuchar» reproduce `/audio/confirmacion/<opción>.wav` (200, `audio/wav`) |
| 9 | Resultados ocultos hasta el cierre | Antes del cierre, `/resultados/<id>` y la API no muestran recuentos; tras el cierre, sí y coinciden con los votos emitidos |
| 10 | Registros del contenedor | Ni IPs, ni cuerpos de petición, ni firmas, certificados o nullifiers; solo líneas `[civora] contexto: CÓDIGO` |
| 11 | CI de la PR | Jobs «Tests, typecheck, build y E2E» e «Imagen Docker» en verde |

## 4. Fusionar

Solo con confirmación explícita del responsable.

1. Anota la configuración actual de producción (variables del servicio y
   commit desplegado) para el [paso 5](#5-volver-atrás-si-algo-falla).
2. Desactiva el despliegue automático de Vercel desde `main` (si no, Vercel
   intentará construir el código nuevo con su configuración antigua; un
   build fallido no sustituye a la versión publicada, pero genera ruido).
3. Configura el servicio de producción de Easypanel con las variables del
   paso 2.
4. Fusiona la PR y despliega el servicio de producción.
5. Repite en producción las comprobaciones 1, 2, 5, 6, 9 y 10 del paso 3.

## 5. Volver atrás si algo falla

1. **Inmediato:** vuelve a la versión anterior según
   [despliegue-vps.md](despliegue-vps.md#7-volver-atrás). Mientras Vercel siga
   activo con la versión anterior, también puedes anunciar de nuevo su URL.
2. **Restaurar variables** a los valores anotados en el paso 4.1.
   - `ADMIN_SECRET` y `NULLIFIER_CERTIFICADO_SECRET` pueden quedarse; el
     código antiguo las ignora. No borres el valor de
     `NULLIFIER_CERTIFICADO_SECRET`: el contrato nuevo lo necesita si se
     vuelve a intentar la migración.
3. **Revertir el merge en `main`:** en la PR fusionada, *Revert* → crea una
   PR de reversión → fusiónala. O en local, en una rama:
   `git revert -m 1 <commit-de-merge>` y PR.
4. El contrato nuevo de Sepolia puede quedarse sin uso; no hace falta
   destruirlo. Las propuestas creadas en él no existirán en el antiguo.
