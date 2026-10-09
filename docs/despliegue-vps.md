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
(job «Imagen Docker», obligatorio en `main`).

## 1. Requisitos

- VPS con Easypanel y acceso de administrador al panel. Civora va en el
  proyecto **`nexuraia`**.
- Easypanel conectado a GitHub con acceso de lectura a
  `mcontrerasdevpro/civora`.
- Contrato desplegado y verificado en Sepolia
  ([despliegue-produccion.md](despliegue-produccion.md#contrato-desplegado)).

## 2. DNS

En el proveedor DNS de `nexuraia.com`:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `civora` | IPv4 del VPS |
| `AAAA` | `civora` | IPv6 del VPS (solo si el VPS tiene IPv6) |

- TTL bajo (300 s) mientras se estabiliza, para poder cambiarlo rápido.
- Si usas Cloudflare, déjalo en «solo DNS» (nube gris) hasta que Easypanel
  emita el certificado de Let's Encrypt.
- Comprueba la resolución antes de seguir: `nslookup civora.nexuraia.com`.

## 3. Un solo servicio

Hay **un único servicio, `civora`**, sin servicio de pruebas separado:

| Momento | Rama de *Source* |
|---|---|
| Antes de fusionar la PR #5 | `actualizar-dependencias` |
| Después de fusionarla | `main` |

Motivos:

- ZKPassport solo acepta pruebas para el dominio del contrato,
  `civora.nexuraia.com`; un segundo dominio no podría probar el flujo ZK.
- Dos servicios compartirían contrato y `NULLIFIER_CERTIFICADO_SECRET`, así
  que no estarían aislados de verdad.
- El VPS es compartido y así se ahorra memoria.

Consecuencia: las comprobaciones previas a la fusión se hacen sobre la demo
pública y sus datos (propuestas y votos de prueba) quedan en el contrato y la
base de datos. Un entorno de pruebas separado, con contrato y dominio propios,
llegará con el VPS dedicado ([ROADMAP](ROADMAP.md#paso-a-producción)).

## 4. Configuración del servicio

En el proyecto `nexuraia`, servicio de tipo *App* llamado `civora`:

1. **Source → GitHub:** propietario `mcontrerasdevpro`, repositorio
   `civora`, rama según la tabla del [paso 3](#3-un-solo-servicio), ruta de
   build `/`.
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
4. **Domains:** `civora.nexuraia.com`, HTTPS activado (Let's Encrypt) y
   **proxy port `3000`**.
5. **Healthcheck:** la imagen declara `HEALTHCHECK` contra
   `http://127.0.0.1:3000/api/salud` (cada 30 s, 3 reintentos, 20 s de
   arranque). Si tu versión de Easypanel permite configurar un healthcheck
   propio, usa la ruta `/api/salud` y el puerto `3000`.
6. **Deploy:** despliega a mano la primera vez y comprueba el
   [paso 6](#6-comprobar-el-despliegue). Activa *Auto Deploy* (webhook de
   GitHub en cada push a la rama) cuando el servicio apunte a `main`.

Si la configuración no es válida (por ejemplo, falta
`NULLIFIER_CERTIFICADO_SECRET`, `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` no es
`false` explícito o el dominio es el de demo), el contenedor termina al
arrancar con `[civora] configuración no válida: …` en sus registros.

### Base de datos (`civora-db`)

Postgres corre en el mismo proyecto como servicio `civora-db`
([ADR 0013](decisiones/0013-postgres-en-el-vps.md)):

1. **+ Service → Postgres**, nombre `civora-db`, base de datos `civora`,
   contraseña generada por Easypanel. **Sin puerto externo.**
2. Copia la *Internal Connection URL* (host `nexuraia_civora-db`, puerto
   `5432`), añade `?sslmode=disable` y ponla en `DATABASE_URL` del servicio
   `civora`. Sin ese parámetro, la web intenta TLS y la conexión falla.
3. Redespliega `civora`. La tabla `propuestas` se crea en la primera
   petición; `/propuestas` debe salir vacía.

No hay copias de seguridad mientras sea una demo.

#### Índice de eventos

`civora-db` guarda también una copia de los eventos públicos de voto
(tablas `eventos_voto` e `indice_eventos`), que el servicio `civora` llena
solo en segundo plano ([ADR 0020](decisiones/0020-indice-incremental-eventos.md)).
Es solo una caché de la cadena, siempre contrastada con el contrato.

- **Primer arranque o contrato nuevo:** define `CONTRATO_BLOQUE_DESPLIEGUE`
  (el número del bloque en decimal, no la dirección del contrato) para que
  no tenga que buscar el bloque de despliegue. Hasta completar la
  carga inicial, `/resultados/<id>` dice que el índice se está completando.
- **Reconstruirlo desde cero**, por ejemplo si la web muestra una
  discrepancia y el contrato da el recuento correcto: en la consola de
  `civora-db` (`psql -U postgres -d civora`), ejecuta
  `TRUNCATE eventos_voto, indice_eventos;`. El servicio lo vuelve a llenar
  solo, sin reiniciarlo. Detalle en el
  [ADR 0020](decisiones/0020-indice-incremental-eventos.md#reconstruir-el-índice-desde-cero).

### Construir y probar la imagen a mano en el VPS

Útil para diagnosticar un build fallido. Desde un clon del repositorio en
el VPS:

```bash
docker build \
  --build-arg NEXT_PUBLIC_ZKPASSPORT_DOMAIN=civora.nexuraia.com \
  --build-arg NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false \
  -t civora-web:prueba .
docker run --rm -d --name civora-prueba --env-file /ruta/segura/civora.env -p 127.0.0.1:3001:3000 civora-web:prueba
curl -fsS http://127.0.0.1:3001/api/salud            # {"estado":"ok"}
docker inspect --format '{{.State.Health.Status}}' civora-prueba   # healthy
docker stop civora-prueba
```

El archivo `.env` de prueba vive fuera del repositorio y con permisos
`600`. Se usa el puerto local `3001` para no chocar con el servicio.

## 5. Contrato

El servicio usa el contrato de
[despliegue-produccion.md, «Contrato desplegado»](despliegue-produccion.md#contrato-desplegado)
(`0xDCfe657B6699c684C0bB841f88a08Fd3390cFC3C`, dominio `civora.nexuraia.com`,
`devMode` desactivado). Si se despliega otro, hay que actualizar
`CONTRATO_DIRECCION` y, si cambian dominio o `devMode`, reconstruir con los
build args nuevos.

## 6. Comprobar el despliegue

1. `curl.exe -fsS https://civora.nexuraia.com/api/salud` devuelve
   `{"estado":"ok"}` y el servicio figura como en ejecución y sano.
2. El certificado HTTPS es de Let's Encrypt y válido para el dominio.
3. Las comprobaciones de
   [despliegue-produccion.md, paso 3](despliegue-produccion.md#3-comprobar-el-servicio-antes-de-fusionar).
4. **Registros:** la aplicación solo escribe líneas
   `[civora] contexto: CÓDIGO`, sin IPs, cuerpos, firmas, certificados ni
   nullifiers (test en `apps/web/test/despliegue.test.mjs`). El proxy de
   Easypanel y Docker son otra historia: revisa y minimiza sus registros
   como indica el
   [modelo de amenazas](modelo-amenazas.md#registros-del-servidor-y-del-proxy).

## 7. Volver atrás

1. **Desplegar la versión anterior:** en el servicio `civora`, cambia la
   rama de *Source* a una rama creada en el último commit bueno (por
   ejemplo, `git branch rollback <commit> && git push origin rollback`) y
   despliega. Revisa también si tu versión de Easypanel permite volver a
   desplegar una implantación anterior desde su historial.
2. **Restaurar las variables** anotadas antes de fusionar
   ([despliegue-produccion.md, paso 4](despliegue-produccion.md#4-fusionar)).
   Si la versión anterior usaba otro contrato o dominio, recuerda que
   `NEXT_PUBLIC_*` son build args: hay que reconstruir.
3. Revierte el merge en `main` según
   [despliegue-produccion.md, paso 5](despliegue-produccion.md#5-volver-atrás-si-algo-falla).
