# Despliegue a producción: Fase 0 + accesibilidad

Procedimiento para llevar a `main` (producción en Vercel) las ramas
`fase-0-seguridad` → `accesibilidad-voto-asistido` → `docs-organizacion` →
`preparar-produccion`. Son lineales sobre `main`: se integran con **una sola
PR desde `preparar-produccion`**.

Objetivo: mantener la demo pública en Sepolia con el mismo comportamiento
que hoy (modo demo de ZKPassport y banner), pero con las protecciones de la
Fase 0. Decisión y límites: [ADR 0010](decisiones/0010-demo-publica-testnet.md).

> **Por qué hace falta un contrato nuevo:** la Fase 0 cambia el constructor
> (relayer inmutable, [ADR 0004](decisiones/0004-relayer-inmutable.md)) y
> restringe `votarManual` y `crearPropuesta`. La web nueva no funciona con el
> contrato antiguo ni al revés.

Orden: [1](#1-desplegar-el-contrato-nuevo-en-sepolia) → [2](#2-variables-de-vercel) →
[3](#3-comprobar-la-preview-antes-de-fusionar) → [4](#4-fusionar) →
[5](#5-volver-atrás-si-algo-falla).

## 1. Desplegar el contrato nuevo en Sepolia

Desde la raíz, en PowerShell. Las variables van en `packages/contracts/.env`
(no se versiona) o en la sesión; **nunca** en archivos versionados.

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
| `ZKPASSPORT_DOMAIN` | el mismo dominio que usa hoy la web (p. ej. `civora-voto.vercel.app`); si se omite, `demo.zkpassport.id` | sin cambios; debe coincidir con `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` |

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

## 2. Variables de Vercel

En *Settings → Environment Variables*. Configúralas primero **solo para
Preview, limitadas a la rama `preparar-produccion`** (Vercel permite
asignar una variable de Preview a una rama). Así la producción actual sigue
con el contrato antiguo hasta la fusión. En el [paso 4](#4-fusionar) se
copian a Production.

Las `NEXT_PUBLIC_*` y `CIVORA_DEMO_TESTNET` se leen durante el build: tras
cambiarlas hay que volver a desplegar.

| Variable | Obligatoria | Valor de ejemplo (sin secretos) | Entorno | Cambio respecto a `main` |
|---|---|---|---|---|
| `CONTRATO_DIRECCION` | sí | `0x…` del paso 1.3 | Preview (rama) → Production al fusionar | **modificada**: contrato nuevo |
| `HARDHAT_RPC_URL` | sí | `https://eth-sepolia.g.alchemy.com/v2/<clave>` | ambos | sin cambios |
| `HARDHAT_RELAYER_PRIVATE_KEY` | sí | clave cuya dirección es `RELAYER_ADDRESS` | ambos | sin cambios, salvo que se rote (exige otro contrato) |
| `DATABASE_URL` | sí | `postgresql://usuario:<contraseña>@host-pooler.neon.tech/neondb?sslmode=require` | ambos; recomendable una rama de Neon distinta para Preview | sin cambios |
| `ADMIN_SECRET` | sí, para crear propuestas | cadena aleatoria larga | ambos (mejor un valor distinto en cada uno) | **nueva** (Fase 0) |
| `RETO_CERTIFICADO_SECRET` | sí, para la vía de certificado | cadena aleatoria larga | ambos | sin cambios; ahora el reto incluye la opción (R-04) |
| `NULLIFIER_CERTIFICADO_SECRET` | sí; el build falla sin ella con RPC no local | cadena aleatoria de 32 caracteres o más (p. ej. `openssl rand -hex 32`) | ambos, **con el mismo valor** | **nueva** (R-02) |
| `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` | sí | el mismo que `ZKPASSPORT_DOMAIN` del contrato (p. ej. `civora-voto.vercel.app`) | ambos | sin cambios; debe coincidir con el contrato |
| `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` | sí | `true` | ambos | **modificada**: antes `true` por defecto; ahora explícita |
| `CIVORA_DEMO_TESTNET` | sí, para la demo | `true` | ambos | **nueva**: sin ella el build falla con el dominio y modo de demo |
| `FALLO_ABIERTO_REVOCACION` | no | `false` o sin definir | ambos | **modificada**: `true` ya no se permite fuera de local; el build falla |

`NODE_ENV` la fija Vercel; no la definas.

**`NULLIFIER_CERTIFICADO_SECRET` es parte del contrato.** Cada nullifier de
certificado se calcula con ella, así que debe ser la misma en Preview y
Production mientras usen el mismo contrato, y no puede cambiar durante su
vida: con otro valor, la misma persona obtendría otro nullifier y podría
votar dos veces. **Guárdala también fuera de Vercel** (gestor de secretos o
de contraseñas). Perderla obliga a desplegar un contrato nuevo, igual que
rotarla ([ADR 0005](decisiones/0005-no-publicar-nif.md)).

Consecuencias de datos: las propuestas guardadas en la base de datos que
apuntan al contrato antiguo no existen en el nuevo y quedan huérfanas. Si
Preview comparte `DATABASE_URL` con Production, las propuestas creadas en la
preview aparecerán en producción antes de fusionar. Por eso conviene una
rama de Neon para Preview.

## 3. Comprobar la preview antes de fusionar

Abre la URL de la preview de `preparar-produccion` y comprueba cada punto.
No fusiones si alguno falla.

| # | Comprobación | Resultado esperado |
|---|---|---|
| 1 | Crear propuesta en `/propuestas/nueva` con `ADMIN_SECRET`, cierre en unos 15 minutos | Se crea y aparece en `/propuestas`. Con una clave incorrecta, error; tras 5 intentos, bloqueo temporal |
| 2 | Votar con certificado digital (Autofirma + certificado FNMT o DNIe) | La confirmación avisa de que se abrirá Autofirma; la firma se pide al pulsar «Sí»; recibo. Un segundo voto con el mismo certificado se rechaza |
| 3 | Flujo ZK en modo demo con la app ZKPassport (documento de prueba) | El QR aparece, la prueba se acepta y se obtiene recibo |
| 4 | Banner | **MODO DEMOSTRACIÓN** visible en todas las páginas |
| 5 | CSP: `curl.exe -sI <url>/votar` | `content-security-policy` con `nonce-…`, `strict-dynamic` y `media-src 'self'`, **sin** `unsafe-eval`; ningún error de CSP en la consola del navegador |
| 6 | Modo sencillo en `/votar/<id>` | El interruptor se recuerda al recargar; letra grande; sin palabras técnicas; confirmación «Va a votar: X. ¿Es correcto?» |
| 7 | Audios | En la confirmación, «Escuchar» reproduce `/audio/confirmacion/<opción>.wav` (200, `audio/wav`) |
| 8 | Resultados ocultos hasta el cierre | Antes del cierre, `/resultados/<id>` y la API no muestran recuentos; tras el cierre, sí y coinciden con los votos emitidos |
| 9 | Tests en la rama | `pnpm --filter @civora/contracts test`, `pnpm --filter web test`, `typecheck`, `build` y `test:e2e` en verde ([AGENTS.md](../AGENTS.md#comandos)) |

## 4. Fusionar

Solo con confirmación explícita del responsable.

1. Anota los valores actuales de Production de `CONTRATO_DIRECCION`,
   `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` y `FALLO_ABIERTO_REVOCACION`, y la URL
   del despliegue de producción vigente (para el [paso 5](#5-volver-atrás-si-algo-falla)).
2. Copia a Production las variables de la tabla del paso 2.
3. Fusiona la PR. Vercel construye y despliega `main`.
4. Repite en producción las comprobaciones 1, 4, 5 y 8 del paso 3.

## 5. Volver atrás si algo falla

1. **Inmediato:** en Vercel, *Deployments* → despliegue de producción
   anterior → *Instant Rollback*. Reasigna el dominio sin reconstruir: ese
   despliegue sigue usando las variables con las que se construyó, es decir,
   el contrato antiguo.
2. **Restaurar variables de Production** a los valores anotados en el paso
   4.1. Si no, el siguiente build usará las nuevas con el código antiguo:
   - `CONTRATO_DIRECCION` = contrato antiguo.
   - Quita `CIVORA_DEMO_TESTNET` (el código antiguo no la usa).
   - Deja `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` como estaba.
   - `ADMIN_SECRET` y `NULLIFIER_CERTIFICADO_SECRET` pueden quedarse; el
     código antiguo las ignora. No borres el valor de
     `NULLIFIER_CERTIFICADO_SECRET`: el contrato nuevo lo necesita si se
     vuelve a intentar la migración.
3. **Revertir el merge en `main`:** en la PR fusionada, *Revert* → crea una
   PR de reversión → fusiónala. O en local, en una rama:
   `git revert -m 1 <commit-de-merge>` y PR.
4. El contrato nuevo de Sepolia puede quedarse sin uso; no hace falta
   destruirlo. Las propuestas creadas durante la prueba en el contrato
   nuevo no existirán en el antiguo.
