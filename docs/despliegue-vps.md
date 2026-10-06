# Despliegue en el VPS con Easypanel

Pasos propios de la plataforma para servir la web en
`https://civora.nexuraia.com` desde un VPS con Easypanel. El procedimiento
general (contrato, variables, comprobaciones, fusión) está en
[despliegue-produccion.md](despliegue-produccion.md); la decisión, en el
[ADR 0011](decisiones/0011-alojamiento-vps-propio.md).

La imagen se construye con el [`Dockerfile`](../Dockerfile) de la raíz:
Node 22 fijado por versión y digest, `pnpm install --frozen-lockfile` (nunca
otras versiones que las del lockfile), salida standalone de Next, usuario no
root, `HEALTHCHECK` contra `/api/salud` y validaciones de arranque en
`apps/web/arranque.js`. El CI construye y arranca la misma imagen en cada PR
(job «Imagen Docker»).

## 1. Requisitos

- VPS con Easypanel instalado y acceso de administrador al panel.
- Easypanel conectado a GitHub con acceso de lectura a
  `mcontrerasdevpro/civora`.
- Contrato desplegado y verificado en Sepolia con
  `ZKPASSPORT_DOMAIN=civora.nexuraia.com`
  ([despliegue-produccion.md, paso 1](despliegue-produccion.md#1-desplegar-el-contrato-nuevo-en-sepolia)).

## 2. DNS

En el proveedor DNS de `nexuraia.com`:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `civora` | IPv4 del VPS |
| `AAAA` | `civora` | IPv6 del VPS (solo si el VPS tiene IPv6) |
| `A` | `pruebas.civora` | IPv4 del VPS (servicio de pruebas) |

- TTL bajo (300 s) durante la migración, para poder volver atrás rápido.
- Si usas Cloudflare, déjalos en «solo DNS» (nube gris) hasta que Easypanel
  emita el certificado de Let's Encrypt.
- Comprueba la resolución antes de seguir: `nslookup civora.nexuraia.com`.

## 3. Servicio de pruebas y servicio de producción

Crea dos servicios de tipo *App* en el mismo proyecto de Easypanel:

| Servicio | Rama | Dominio | Uso |
|---|---|---|---|
| `civora-pruebas` | la rama de la PR (hoy `despliegue-vps`) | `pruebas.civora.nexuraia.com` | Comprobaciones antes de fusionar |
| `civora` | `main` | `civora.nexuraia.com` | Producción |

Los dos usan el mismo contrato y, por tanto, el **mismo**
`NULLIFIER_CERTIFICADO_SECRET`; `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` es
`civora.nexuraia.com` en ambos (identifica la aplicación ante ZKPassport,
no el host). Usa una base de datos distinta para pruebas. Al terminar la
migración puedes detener `civora-pruebas`.

## 4. Servicio en Easypanel

Para cada servicio:

1. **Source → GitHub:** propietario `mcontrerasdevpro`, repositorio
   `civora`, rama según la tabla anterior, ruta de build `/`.
2. **Build → Dockerfile**, archivo `Dockerfile` (en la raíz).
3. **Environment:** las variables de
   [despliegue-produccion.md, paso 2](despliegue-produccion.md#2-variables-de-la-web).
   Easypanel las pasa en el build y en ejecución:
   - `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` y `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` son
     los únicos build args que usa el Dockerfile: se incrustan en el
     JavaScript y quedan en la imagen. Cambiarlos exige reconstruir.
   - El resto solo se leen al ejecutar. Los secretos no quedan en la imagen
     porque el Dockerfile no los declara como `ARG`; no añadas nunca un
     `ARG` para un secreto.
4. **Domains:** `civora.nexuraia.com` (o el de pruebas), HTTPS activado
   (Let's Encrypt) y **proxy port `3000`**.
5. **Healthcheck:** la imagen declara `HEALTHCHECK` contra
   `http://127.0.0.1:3000/api/salud` (cada 30 s, 3 reintentos). Si tu versión
   de Easypanel permite configurar un healthcheck propio, usa la ruta
   `/api/salud` y el puerto `3000`.
6. **Deploy:** despliega a mano la primera vez y comprueba el
   [paso 6](#6-comprobar-el-despliegue). Activa *Auto Deploy* (webhook de
   GitHub en cada push a la rama) solo después.

Si la configuración no es válida (por ejemplo, falta
`NULLIFIER_CERTIFICADO_SECRET` o `DEV_MODE=true` sin `CIVORA_DEMO_TESTNET`),
el contenedor termina al arrancar con `[civora] configuración no válida: …`
en sus registros.

### Construir y probar la imagen a mano en el VPS

Útil para diagnosticar un build fallido. Desde un clon del repositorio en
el VPS:

```bash
docker build \
  --build-arg NEXT_PUBLIC_ZKPASSPORT_DOMAIN=civora.nexuraia.com \
  --build-arg NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=true \
  -t civora-web:prueba .
docker run --rm -d --name civora-prueba --env-file /ruta/segura/civora.env -p 127.0.0.1:3000:3000 civora-web:prueba
curl -fsS http://127.0.0.1:3000/api/salud            # {"estado":"ok"}
docker inspect --format '{{.State.Health.Status}}' civora-prueba   # healthy
docker stop civora-prueba
```

El archivo `.env` de prueba vive fuera del repositorio y con permisos
`600`.

## 5. Contrato

Antes del primer despliegue, el contrato debe estar desplegado con
`ZKPASSPORT_DOMAIN=civora.nexuraia.com` y verificado con
`verificar:sepolia`
([despliegue-produccion.md, paso 1](despliegue-produccion.md#1-desplegar-el-contrato-nuevo-en-sepolia)).

## 6. Comprobar el despliegue

1. `curl.exe -fsS https://civora.nexuraia.com/api/salud` devuelve
   `{"estado":"ok"}` y el servicio figura como en ejecución y sano.
2. El certificado HTTPS es de Let's Encrypt y válido para el dominio.
3. Las comprobaciones de
   [despliegue-produccion.md, paso 3](despliegue-produccion.md#3-comprobar-el-servicio-de-pruebas-antes-de-fusionar).
4. **Registros:** la aplicación solo escribe líneas
   `[civora] contexto: CÓDIGO`, sin IPs, cuerpos, firmas, certificados ni
   nullifiers (test en `apps/web/test/despliegue.test.mjs`). El proxy de
   Easypanel y Docker son otra historia: revisa y minimiza sus registros
   como indica el
   [modelo de amenazas](modelo-amenazas.md#registros-del-servidor-y-del-proxy).

## 7. Volver atrás

1. **Desplegar la versión anterior:** en el servicio de Easypanel, cambia
   la rama de *Source* a una rama creada en el último commit bueno (por
   ejemplo, `git branch rollback <commit> && git push origin rollback`) y
   despliega. Revisa también si tu versión de Easypanel permite volver a
   desplegar una implantación anterior desde su historial.
2. **Restaurar las variables** anotadas antes de fusionar
   ([despliegue-produccion.md, paso 4](despliegue-produccion.md#4-fusionar)).
   Si la versión anterior usaba otro contrato o dominio, recuerda que
   `NEXT_PUBLIC_*` son build args: hay que reconstruir.
3. **Si el problema es del alojamiento:** mientras Vercel siga activo con la
   versión anterior, vuelve a anunciar su URL y, si cambiaste DNS, apunta de
   nuevo el registro (el TTL bajo del [paso 2](#2-dns) acelera el cambio).
4. Revierte el merge en `main` según
   [despliegue-produccion.md, paso 5](despliegue-produccion.md#5-volver-atrás-si-algo-falla).
