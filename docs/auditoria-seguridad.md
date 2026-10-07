# Auditoría de seguridad

**Fecha:** 2026-10-05
**Alcance:** revisión estática de contratos, rutas API, flujo de identidad/voto, configuración del frontend y pruebas disponibles. Esto no sustituye una auditoría criptográfica del circuito ZK, del SDK ni una evaluación de despliegue.

> Los hallazgos detallados documentan el estado inicial revisado. Estado después de la remediación de Fase 0:

| Hallazgo | Estado Fase 0 | Alcance y riesgo pendiente |
|---|---|---|
| C-01 | Mitigado en la aplicación | Se eliminó la vía manual de UI/API; `votarManual` y `crearPropuesta` solo aceptan al relayer inmutable. No sustituye un censo ni resuelve la deduplicación entre vías. |
| C-02 | Resuelto para configuración | `DEV_MODE` queda desactivado por defecto; web y despliegue públicos exigen dominio propio y `false` explícito. Excepción con opt-in `CIVORA_DEMO_TESTNET=true`, solo desplegable en Sepolia ([ADR 0010](decisiones/0010-demo-publica-testnet.md)). La demo requiere opt-in y muestra banner. |
| A-01 | Parcial | Se elimina el respaldo emisor+serie y se rechaza un certificado sin NIF. El servidor todavía recibe certificado y opción en el mismo flujo. |
| M-01 | Mitigado en la aplicación | UI, API de resultados y respuestas de voto ocultan recuentos hasta el cierre. La cadena pública sigue exponiendo eventos y almacenamiento. |
| M-03 | Parcial | Se autoalojan fuentes y se añade CSP con nonce. El SDK ZKPassport y el script de Autofirma siguen requiriendo control de cadena de suministro. |
| M-04 | Riesgo aceptado en la demo (2026-10-07) | `POST /api/propuestas` ya no exige `ADMIN_SECRET`: cualquiera puede crear propuestas, limitado a 5 por IP cada 15 minutos (en memoria, por instancia). El contrato sigue limitando la creación al relayer, que paga el gas. Volver a exigir autorización antes de producción real. |

La arquitectura de identidad, el censo verificable y el secreto criptográfico de papeleta quedan fuera de Fase 0 y no se consideran resueltos.

## Revisión externa (2026-10-06, rama `correcciones-revision`)

| Hallazgo | Severidad | Estado | Resumen |
|---|---|---|---|
| [R-01](#r-01--crítico--la-opción-no-está-atada-a-la-prueba-zk-front-running) | Crítico | **Abierto, primera prioridad del spike** | `votarConPruebaZk` no ata la opción a la prueba: se puede reenviar la misma prueba con otra opción. |
| [R-02](#r-02--crítico--nullifier-de-certificado-enumerable-y-publicado) | Crítico | Corregido | Nullifier de certificado con HMAC y secreto; la nota on-chain ya no lo incluye. |
| [R-03](#r-03--alto--nif-sin-normalizar) | Alto | Corregido | DNI normalizado y con letra de control validada; NIE y otros formatos rechazados. |
| [R-04](#r-04--medio--la-opción-no-forma-parte-del-reto-firmado) | Medio | Corregido | El reto firmado incluye la opción y el servidor la verifica. |
| [R-05](#r-05--bajo--constructor-sin-comprobación-de-dirección-cero-y-natspec-obsoleto) | Bajo | Corregido | El constructor rechaza la dirección cero; NatSpec actualizado. |

## Accesibilidad y voto asistido (2026-10-06, rama `accesibilidad-voto-asistido`)

Cambios de interfaz sin tocar contratos, identidad ni rutas API:

- **CSP:** se añade `media-src 'self'` para los audios de confirmación; el resto de la política y el nonce no cambian. El modo sencillo no usa scripts inline.
- **Síntesis de voz:** `speechSynthesis` solo con voces `localService`; la opción elegida no pasa nunca por la síntesis, se reproduce con audios propios (provisionales, voz local; se sustituirán por grabaciones profesionales). Detalle en [modelo-amenazas.md](modelo-amenazas.md#inclusión-y-voto-asistido).
- **Confirmación explícita** antes de enviar el voto, en modo normal y sencillo.
- **Reto de certificado caducado (5 min en servidor):** la interfaz avisa y permite firmar de nuevo conservando datos y opción. Eliminar el límite para voto asistido queda pendiente para la Fase 1.
- **CSP de desarrollo:** `next dev` necesita `eval` y sin él las páginas no se hidrataban. `crearCsp` añade `'unsafe-eval'` solo con `NODE_ENV=development`; la política de build/start no cambia. Un test unitario y otro E2E (cabecera real de `next start`) fallan si aparece en producción.

Verificación: `pnpm --filter web test` (15 pruebas), `typecheck`, `build` y `pnpm --filter web test:e2e` (26 pruebas: axe WCAG 2.1 A/AA en cada paso, modo normal y sencillo, 1280 y 375 px).

## Despliegue en VPS (2026-10-06, rama `despliegue-vps`)

- **Fuga del nullifier en registros (corregida):** `GET /api/propuesta/votos/[nullifier]` registraba el error completo de ethers, que incluye la petición `eth_getLogs` con el nullifier; las rutas de voto relanzaban errores del contrato que Next registra con la transacción (nullifier y opción), y `POST /api/propuestas` devolvía al cliente el mensaje de ethers. Ahora solo `lib/registro.mjs` escribe en la consola, con un contexto fijo y un código corto; un test falla si otro archivo del servidor usa `console.*` o si una ruta relanza errores.
- **Validaciones de arranque en la imagen:** el servidor standalone de Next no ejecuta `next.config.js`; `arranque.js` repite las validaciones (`lib/validar-entorno.js`) y el contenedor no arranca si fallan. Test: sin `NULLIFIER_CERTIFICADO_SECRET` y con RPC público, `arranque.js` termina con código 1.
- **Imagen:** base fijada por digest, lockfile congelado, usuario no root, sin `.env` ni tests, secretos solo en ejecución. El job «Imagen Docker» del CI la construye y comprueba healthcheck, `/api/salud`, CSP sin `unsafe-eval`, usuario no root y ausencia de `.env`. No se ha podido construir en local (sin Docker); queda verificada por ese job.
- **Registros fuera de la aplicación:** proxy de Easypanel, Docker y proveedores; ver [modelo de amenazas](modelo-amenazas.md#registros-del-servidor-y-del-proxy).

## Dependencias (2026-10-06, rama `actualizar-dependencias`)

Punto de partida: 90 alertas de Dependabot; `pnpm audit` daba 69 avisos
(2 críticos, 27 altos, 31 moderados, 9 bajos), 31 de ellos con `--prod`.
Resultado: **`pnpm audit --prod` sin vulnerabilidades**; quedan 4 avisos solo
de desarrollo, sin versión corregida.

| Paquete | Uso | Avisos | Estado |
|---|---|---|---|
| `next` 14.2.35 | runtime | 2 críticos (RCE en el optimizador de imágenes con AVIF; RCE en Windows), 8 altos, 11 moderados, 2 bajos | **Corregido:** 15.5.27 ([ADR 0012](decisiones/0012-next-15-react-19.md)); además, optimizador desactivado (`images.unoptimized`, `/_next/image` da 404) |
| `postcss` 8.4.31 (fijada por Next) | runtime | 2 altos, 2 moderados | **Corregido:** override a 8.5.29 |
| `source-map-js` 1.2.1 | runtime | 1 alto | **Corregido:** override `^1.2.2` |
| `ws` 8.17.1 y 8.18.0 (ethers, SDK de ZKPassport) | runtime | 1 alto, 1 moderado | **Corregido:** override `^8.21.0` |
| `node-forge` 1.4.0 | runtime | 1 alto (GHSA-86w9-cpqp-85rv: firmas RSA PKCS#1 v1.5 falsificables con exponente bajo), **sin parche** | **Corregido en runtime:** la cadena del certificado se verifica con `crypto.X509Certificate` (`lib/cadena-certificados.mjs`); `node-forge` queda solo en los tests. Exposición previa baja: las raíces FNMT y DGP usan RSA 4096 con e=65537 |
| `undici`, `@fastify/busboy`, `adm-zip`, `tmp`, `lodash`, `serialize-javascript`, `bn.js`, `cookie`, `diff`, `uuid` | desarrollo (Hardhat 2 y su toolbox) | 33 | **Corregido:** Hardhat 2.29.1 y overrides; verificado con compilación descargando `solc`, tests de contratos y despliegue por JSON-RPC en un nodo local |
| `braces` 3.0.3 | desarrollo (`solidity-coverage` → `mocha`/`fast-glob`) | 1 alto, sin parche | **Riesgo aceptado:** solo se ejecuta en desarrollo con patrones del propio repositorio |
| `node-forge` 1.4.0 | desarrollo (tests) | 1 alto, sin parche | **Riesgo aceptado:** solo fabrica certificados de prueba; no verifica nada |
| `sprintf-js` 1.0.3 | desarrollo (`solidity-coverage`) | 1 moderado, sin parche | **Riesgo aceptado:** sin entrada externa |
| `elliptic` 6.6.1 | desarrollo (`ethereumjs-util` de Hardhat) | 1 bajo, sin parche | **Riesgo aceptado:** solo firma con cuentas de prueba del nodo local; la web usa `ethers` |

Ninguno de los paquetes con riesgo aceptado llega a la imagen Docker: la
etapa de dependencias instala solo `--filter "web..."` y `node-forge` es
`devDependency`. Los overrides están en `package.json` (`pnpm.overrides`,
para pnpm 9.0.0, el de `packageManager`) y, con el mismo contenido, en
`pnpm-workspace.yaml` (para pnpm 10 y 11), y quedan registrados en
`pnpm-lock.yaml`; un test comprueba que coinciden
([AGENTS.md](../AGENTS.md#comandos)). Regla nueva: revisar `pnpm audit --prod` antes de cada
despliegue ([AGENTS.md](../AGENTS.md#reglas-de-trabajo)).

Verificación: 20 tests de contratos, 46 de web, typecheck, build, 36 E2E
con axe y revisión manual con Playwright del flujo de voto con certificado
en modo normal (1280 px) y sencillo (375 px), sin errores ni avisos en la
consola. La imagen Docker la verifica el job «Imagen Docker» del CI.

## Revisión en producción (2026-10-07, rama `actualizar-dependencias`)

- **CSP bloqueaba el JavaScript de las páginas estáticas (crítico, corregido; viene de la Fase 0):** Next solo añade el nonce a las páginas renderizadas en cada petición. `/`, `/propuestas`, `/propuestas/nueva`, `/verificar`, `/resultados` y `/votar` se generaban en el build sin nonce, la CSP bloqueaba sus scripts y React no arrancaba: no se veía el listado, no se podían crear propuestas ni comprobar recibos. Ahora `app/layout.tsx` llama a `connection()` y todas las páginas se renderizan por petición (ninguna se sirve pregenerada; asumible en la demo). Los E2E no lo detectaban porque solo usaban `/votar/<id>`, que ya era dinámica.
- **E2E nuevo (`e2e/paginas.spec.ts`):** recorre todas las páginas y falla si algún `<script>` del HTML no lleva nonce o si hay alguna violación de CSP; comprueba que `/propuestas` muestra el listado, que `/verificar` comprueba un recibo y que `/resultados/<id>` avisa si no hay resultados. Comprobado que falla sin `connection()` (8 fallos en las 6 páginas estáticas y en las 2 comprobaciones funcionales).
- **`/resultados/<id>` nunca cargaba (corregido, lo destapó el E2E nuevo):** el identificador del intervalo de refresco ocultaba el `id` de la ruta; la primera carga fallaba y las siguientes pedían `/api/propuestas/<número>`.
- **500 con propuestas del contrato anterior (corregido):** `GET /api/propuestas/[id]` leía los resultados sin proteger la llamada y Next registraba el error completo de ethers. Ahora registra solo el código con `lib/registro.mjs` y responde `resultados: null` con `resultadosNoDisponibles: true`; la página muestra «Los resultados de esta propuesta no están disponibles».
- **Cabeceras:** sin `X-Powered-By` (`poweredByHeader: false`) y con `Referrer-Policy: no-referrer`, porque `/verificar?nullifier=…` lleva el recibo en la URL y podría filtrarse en el `Referer` a sitios externos. Las comprueba el E2E nuevo.

- **Base de datos en el VPS ([ADR 0013](decisiones/0013-postgres-en-el-vps.md), rama `docs/postgres-vps`):** servicio `civora-db` sin puerto externo y `sslmode=disable` solo en la red interna de Docker. Comprobado que en `pg` 8.23 el `sslmode=disable` de la URL prevalece sobre `ssl: { rejectUnauthorized: false }` de `lib/db.ts` (`ssl` queda en `false`). Sin copias de seguridad mientras sea demo; solo guarda el contenido de las propuestas, ningún dato de votantes.

Verificación: 20 tests de contratos, 46 de web, typecheck, build (todas las
páginas dinámicas, `ƒ`) y 60 E2E.

## CSP y Autofirma (2026-10-07, rama `fix/csp-autofirma`)

- **La CSP impedía abrir Autofirma (crítico, corregido; viene de la Fase 0):** `autoscript.js` 1.10.1 abre Autofirma con el esquema `afirma://` y después se conecta a ella en `127.0.0.1`. `connect-src` solo permitía `http://127.0.0.1:*` y `http://localhost:*`, así que el WebSocket `wss://127.0.0.1:<puerto>` de Chrome y Edge quedaba bloqueado. Además, `frame-src` no estaba definido y heredaba `default-src 'self'`, lo que bloqueaba el iframe `afirma://` de Firefox y Safari. La vía de certificado no funcionaba en ningún navegador. Reproducido en `civora.nexuraia.com` con Chromium: `Connecting to 'wss://127.0.0.1:63117/' violates … connect-src` y `Framing '' violates … default-src`.
- **Corrección:** `connect-src` añade `wss://127.0.0.1:*` y `https://127.0.0.1:*` (la alternativa por socket). La nueva directiva `frame-src 'self' afirma:` admite solo el esquema de Autofirma. Se retiran `http://localhost:*` y `http://127.0.0.1:*`: el navegador no los usa, porque el RPC de Hardhat solo lo usa el servidor (`lib/contrato.ts`).
- **Por qué no lo detectaban los E2E:** sustituyen Autofirma por un simulacro sin conexiones. El E2E nuevo de `e2e/paginas.spec.ts` abre el iframe `afirma://`, el WebSocket `wss://127.0.0.1` y un `fetch` `https://127.0.0.1` con la CSP de `next start`, y falla si hay violaciones. Comprobado que falla con la CSP anterior (`connect-src wss://127.0.0.1:63117/` y `frame-src`). El test unitario `admin-auth.test.mjs` fija las directivas.
- **Favicon:** `app/icon.svg`; antes `/favicon.ico` daba 404 en cada página.
- **Pendiente:** firma real con Autofirma instalada y un certificado en Chrome, Edge y Firefox tras desplegar. No se puede automatizar en el CI.

Verificación: 20 tests de contratos, 50 de web, typecheck, build y 64 E2E.

## Aviso de escuchas ajenas (2026-10-07, rama `feat/aviso-escuchar`)

- Al pulsar «Escuchar» (instrucciones de cada paso y confirmación de la opción) aparece un aviso con `role="alert"` y suena el mismo aviso por voz: «Baje el volumen o use auriculares: otras personas cerca de usted podrían oír su voto.» El aviso no contiene la opción.
- No se lee nada hasta pulsar «Llevo auriculares puestos»; «Cancelar» detiene el aviso. El foco pasa al botón de confirmación. El navegador no puede detectar auriculares, así que la confirmación es declarada.
- La confirmación sigue sin pasar por `speechSynthesis`: el aviso es un audio propio (`public/audio/confirmacion/aviso-escuchas.wav`, voz local Helena, provisional como los demás). En las demás pantallas se lee con la voz local.
- E2E: el aviso aparece antes de leer, el texto solo se lee tras confirmar, cancelar no lee nada y axe sin infracciones en el aviso. Revisado a 375 y 1280 px.

Verificación: 51 tests de web, typecheck, build y 72 E2E.

## Revisión del PR #5 (2026-10-07, rama `fix/revision-pr5`)

Revisión de todo lo que lleva `actualizar-dependencias` a `main`, sin el lockfile ni `autoscript.js`.

- **C-03, crítico (corregido):** la firma podía hacerse con un certificado distinto del validado. Ver [C-03](#c-03--crítico--la-firma-no-se-ataba-al-certificado-validado-corregido).
- **«Verificar mi voto ahora» fallaba siempre con la votación abierta (corregido):** la API responde 423 a los recibos hasta el cierre (M-01), pero el asistente ofrecía verificar al momento y `/verificar` lo mostraba como «No se ha podido comprobar el recibo». Ahora el recibo indica la fecha de cierre y `/verificar` explica que la votación sigue abierta. Los resultados de `/verificar` se anuncian con `aria-live`.
- **El título de `/resultados/<id>` se quedaba en «Cargando…» (corregido)** con los resultados ocultos, no disponibles o tras un error.
- E2E de los tres casos; revisado a 375 y 1280 px.

Verificación: 20 tests de contratos, 51 de web, typecheck, build y 70 E2E.

## Resumen ejecutivo

**El proyecto no debe utilizarse para una votación real o vinculante en su estado actual.** La Fase 0 ha mitigado la vía manual de aplicación, el modo demo inseguro por defecto, la creación pública de propuestas y la exposición de resultados por web. Siguen abiertos el vínculo identidad-voto de certificado, la publicación individual en cadena, la ausencia de censo Merkle y la falta de deduplicación común entre vías.

Las severidades se refieren al impacto potencial en una elección real; esta es una PoC. Las conclusiones sobre terceros e infraestructura están limitadas al código revisado y no incluyen configuración del proveedor de hosting/RPC ni análisis dinámico.

## Hallazgos

### C-01 · Crítico — El voto manual permitía saltarse identidad, elegibilidad y unicidad efectiva (mitigado en Fase 0)

En el estado inicial, `votarManual` registraba el nullifier recibido sin autenticarlo ni comprobar una prueba. La API manual aceptaba un nullifier del cliente. Fase 0 elimina esa ruta de UI/API y restringe `votarManual` al relayer inmutable; el camino restante lo invoca solo el endpoint de certificado tras validar la firma y el certificado.

La vía manual inicial calculaba `SHA-256(propuestaId:DNI_normalizado)` sin secreto. Como el DNI tiene un espacio de búsqueda pequeño y el identificador de propuesta es público, un tercero podía enumerar DNIs plausibles y vincular los nullifiers manuales a documentos.

**Arreglo propuesto:** retirar la vía manual en producción. Hacer que el contrato solo acepte nullifiers derivados de pruebas verificables o de credenciales/atestaciones de elegibilidad verificadas. No aceptar nullifiers elegidos por el cliente. Para conservar una vía alternativa, diseñar una emisión de credencial con secreto aleatorio y deduplicación común a todos los métodos; nunca publicar un hash directo del DNI.

### C-02 · Crítico — El modo de pruebas ZK quedaba activado por defecto en redes públicas (resuelto en Fase 0)

En el estado inicial, web y despliegue habilitaban demo si faltaba configuración. Fase 0 exige opt-in explícito para demo, deja el valor por defecto en `false` y rechaza configuración pública sin dominio propio y `false` explícito. La web comprueba también estas variables en producción.

**Impacto:** un despliegue público con variables omitidas puede aceptar pruebas de demostración, no solo pruebas de documentos reales; la elegibilidad deja de tener la garantía esperada.

**Arreglo propuesto:** invertir el valor por defecto: producción debe fallar al arrancar/desplegar si no hay dominio registrado y `devMode=false`. Añadir un control de CI o de despliegue que rechace el modo mock en redes públicas y verificar las variables efectivas contra el constructor inmutable.

### C-03 · Crítico — La firma no se ataba al certificado validado (corregido)

`verificarFirmaCertificado` validaba la cadena FNMT/DGP, el DNI y la revocación sobre el certificado enviado en `certB64`, pero `SignedData.verify` de pkijs busca el certificado firmante solo dentro del CMS (por emisor y número de serie o por identificador de clave). Nada exigía que fueran el mismo. Con el certificado público de otra persona (por ejemplo, el incluido en cualquier PDF firmado) y un certificado propio con el mismo emisor y número de serie dentro del CMS, firmado con una clave propia, la firma y la cadena se daban por buenas y el voto contaba con el DNI de la víctima, una vez por propuesta y por cada certificado público obtenido. Existía desde la primera versión de la vía de certificado.

**Corrección:** `verify` con `extendedMode: true` devuelve el certificado firmante, y se rechaza la firma si no coincide (misma serialización DER) con `certB64`. El test `rechaza una firma válida hecha con otra clave que el certificado enviado` reproduce el ataque; sin la corrección, la firma pasaba y solo la paraba la cadena porque el certificado de prueba no es de la FNMT.

### A-01 · Alto — La vía de certificado vincula identidad y opción en el servidor (NIF endurecido en Fase 0)

Una sola petición envía `propuestaId`, `opcion`, firma y certificado; el servidor verifica el certificado, deriva el identificador y envía la opción al contrato. En Fase 0 se elimina el respaldo emisor+serie y se rechaza un certificado sin NIF. El backend todavía puede conocer quién ha votado qué en esta vía; no hay separación criptográfica identidad-voto.

**Arreglo propuesto:** no aceptar certificado, identidad y papeleta en el mismo servicio de confianza. Emitir previamente una credencial anónima no enlazable y verificar una prueba de elegibilidad de conocimiento cero en el contrato. El identificador para deduplicación debe ser específico de elección, no revelar NIF ni número de serie.

### A-02 · Alto — Votos y nullifiers son públicos y no están cifrados

El contrato guarda la opción asociada a cada nullifier en una `mapping` pública y la emite en `VotoEmitido` ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L58), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L61), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L152), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L162)). `votoDe` también devuelve la opción para un nullifier ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L177), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L183)). Las transacciones y eventos de una cadena pública son observables. No hay cifrado de papeletas, mezcla ni recuento homomórfico.

En la vía ZK el nullifier se calcula a partir de la prueba verificada y su ámbito incluye la propuesta ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L141), [index.ts](../packages/zk-identity/src/index.ts#L42)); esto limita la correlación entre propuestas, pero no oculta la opción dentro de una propuesta ni garantiza que todas las vías compartan el mismo identificador.

**Arreglo propuesto:** para secreto de papeleta, no publicar la opción asociada a un nullifier. Adoptar un protocolo de voto cifrado con recuento verificable (por ejemplo, cifrado homomórfico o mezcla verificable), someterlo a revisión criptográfica y publicar solo pruebas/recuentos que no revelen papeletas individuales.

### A-03 · Alto — No hay censo congelado ni raíz Merkle de elegibles

No se encontró árbol Merkle, raíz de censo ni verificador de pertenencia en el contrato ni en la capa ZK revisada. La ruta ZK comprueba edad y nacionalidad; la unicidad se lleva en un mapping por propuesta, no en una raíz de censo ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L57), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L132), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L141)). La vía manual ni siquiera acredita esos requisitos. El `scope` específico por propuesta no constituye un censo.

**Impacto:** no hay una lista/raíz verificable de quién tenía derecho a participar, ni evidencia on-chain de que esa lista quedara cerrada antes de abrir la votación.

**Arreglo propuesto:** definir la autoridad y proceso de formación del censo; publicar y congelar una raíz Merkle antes de abrir; verificar en la prueba ZK la pertenencia a esa raíz y el nullifier específico de la elección. Acordar cómo se auditan altas, bajas, impugnaciones y privacidad del censo.

### A-04 · Alto — Una misma persona puede usar vías con espacios de nullifier distintos

La vía manual de la aplicación se retiró en Fase 0. Sigue sin existir un identificador común verificable entre certificado y ZK; el contrato compara únicamente el nullifier exacto y no vincula métodos. No hay evidencia en este repositorio para afirmar que el SDK de ZKPassport equipare siempre un DNI y un pasaporte de la misma persona.

**Arreglo propuesto:** un único mecanismo de deduplicación verificable y común a todos los medios de acreditación, ligado a una credencial/censo y a la elección. Añadir pruebas de integración que prueben explícitamente los intentos cruzados DNI, pasaporte, certificado y renovación.

### M-01 · Medio — Los resultados parciales eran visibles durante la votación (mitigado en la aplicación)

La UI y API iniciales devolvían recuentos durante la votación, incluidas las respuestas de voto. Fase 0 no consulta ni devuelve los resultados de aplicación hasta el cierre. La publicación individual de papeletas en cadena aún permite observar tendencias directamente.

**Arreglo propuesto:** ocultar o retrasar resultados hasta el cierre, tanto en UI/API como en la información publicada en cadena. La API por sí sola no puede ocultar datos ya públicos en el contrato.

### M-02 · Medio — El relayer reduce la exposición de la wallet del votante, pero concentra confianza y correlación

Las transacciones las firma una wallet de relayer del servidor y esta paga el gas ([contrato.ts](../apps/web/lib/contrato.ts#L22), [contrato.ts](../apps/web/lib/contrato.ts#L59), [contrato.ts](../apps/web/lib/contrato.ts#L73)). Por tanto, la dirección on-chain es la del relayer, no la wallet del votante; no se exige wallet al votante. Las opciones y nullifiers sí son públicos en cadena (A-02). El servidor recibe la petición de voto y su IP de origen puede quedar en registros del hosting, proxy o RPC; el repositorio no demuestra qué registros se conservan. En la ruta de certificado la correlación con la identidad es directa (A-01).

**Arreglo propuesto:** minimizar y documentar logs, establecer retención corta, evitar datos identificativos en telemetría, usar separación de servicios/red y considerar relayers distribuidos o mecanismos de privacidad de red. Esto no sustituye el secreto criptográfico de la papeleta.

### M-03 · Medio — Dependencias de terceros y superficie del script de Autofirma (parcial en Fase 0)

No se encontraron etiquetas de analítica ni píxeles. Fase 0 sustituye Google Fonts por `next/font` y añade CSP con nonce y conexiones limitadas. El flujo ZK aún depende del SDK `@zkpassport/sdk` y contacta con el dominio configurado; Autofirma sigue usando un script same-origin cuyo origen y proceso de actualización requieren control de cadena de suministro.

**Arreglo propuesto:** autoalojar fuentes, aplicar CSP estricta y política de conexión limitada; fijar y revisar versiones/lockfile y cadena de suministro del SDK; revisar el origen y proceso de actualización del JavaScript de Autofirma y mantenerlo versionado/auditado localmente. Confirmar en despliegue real el tráfico y la política de logs de terceros.

### M-04 · Medio — Creación de propuestas sin autorización (riesgo aceptado en la demo)

La ruta `POST /api/propuestas` inicialmente carecía de control de acceso. Fase 0 exigió `ADMIN_SECRET`, comparado con `timingSafeEqual`. **El 2026-10-07 se retira la clave** (rama `feat/creacion-abierta`) para que cualquiera pueda probar la demo, tras filtrarse la clave en una sesión de trabajo. Queda el rate limit por IP (5 cada 15 minutos, en memoria por instancia) y el contrato sigue permitiendo crear propuestas únicamente al relayer inmutable.

**Riesgos aceptados:** gasto del relayer en Sepolia (si se queda sin saldo, la demo deja de registrar votos) y contenido sin moderar en el listado público; el hash de cada propuesta queda en el contrato aunque se borre de la base de datos.

**Arreglo propuesto:** restaurar autenticación y autorización en servidor, limitar tasa y validar que la propuesta se aprueba antes de enviar la transacción. No exponer secretos al cliente.

### R-01 · Crítico — La opción no está atada a la prueba ZK (front-running)

`votarConPruebaZk` recibe la prueba y la opción por separado. La prueba acredita la elegibilidad para la propuesta, pero no la opción. Quien vea la transacción antes de que se mine (el relayer, que la construye, o cualquier observador de la mempool) puede enviar la misma prueba con otra opción y con más gas: el contrato acepta la primera que llega y consume el nullifier, y el voto legítimo se rechaza por repetido.

**Impacto:** un voto ZK puede sustituirse por otro de distinta opción sin que el votante lo note hasta verificar su recibo.

**Estado:** abierto. Es la primera prioridad del [spike ZKPassport](ROADMAP.md#spike-zkpassport-deduplicación-entre-vías). Descrito en el [modelo de amenazas](modelo-amenazas.md#front-running-de-votos-zk-r-01).

**Arreglo previsto:** atar la opción a la prueba (por ejemplo, incluirla en los datos vinculados que ZKPassport firma junto al ámbito) y verificar en el contrato que la opción recibida es la de la prueba.

### R-02 · Crítico — Nullifier de certificado enumerable y publicado

El nullifier de certificado era `SHA-256(propuestaId:certificado:NIF)`, sin secreto, y se publicaba on-chain como nullifier y, además, dentro de la nota de `votarManual`. Con el identificador de la propuesta (público) y el espacio pequeño de DNI, cualquiera podía recalcularlo para cada DNI y saber quién votó y qué.

**Corrección:** `HMAC-SHA256(NULLIFIER_CERTIFICADO_SECRET, propuestaId:certificado:DNI)` en `lib/nullifier-certificado.mjs`. La variable es obligatoria fuera de un RPC local (al menos 32 caracteres) y se valida al arrancar en `next.config.js`; con RPC local se usa un valor fijo de desarrollo. La nota on-chain es solo `"certificado"`. Tests: el arranque falla con RPC no local y sin secreto; el resultado depende del secreto y no coincide con hashes sin secreto.

**Riesgo residual:** el operador, que conoce el secreto, puede recalcular el nullifier y vincular identidad y voto (A-01, [ADR 0005](decisiones/0005-no-publicar-nif.md)). Cambiar o perder el secreto durante la vida de un contrato permitiría votar dos veces: rotarlo exige un contrato nuevo ([despliegue](despliegue-produccion.md)).

### R-03 · Alto — NIF sin normalizar

El NIF se tomaba tal cual del atributo `serialNumber`. El mismo DNI con distinto formato (`IDCES-12345678Z`, `12345678Z`, minúsculas, guiones) producía nullifiers distintos y permitía votar dos veces; tampoco se comprobaba que fuera un DNI.

**Corrección:** `normalizarDniCertificado` en `lib/nif-certificado.mjs` acepta los prefijos ETSI EN 319 412-1 (`IDCES-`, `PNOES-`, `TINES-`, `TAXES-`) y `NIF`, elimina separadores, exige 8 cifras y una letra de control válida y rechaza NIE y otros formatos. Tests con varios formatos que producen el mismo nullifier.

### R-04 · Medio — La opción no forma parte del reto firmado

El reto era `HMAC(propuestaId:timestamp)` y se firmaba antes de elegir. La firma no cubría la opción, así que quien tuviera la petición podía cambiar la opción conservando la firma.

**Corrección:** el reto es `HMAC(propuestaId:timestamp:opcion)` y el servidor lo recalcula con la opción recibida. La firma se pide en la confirmación, tras avisar en texto y en audio de que se abrirá Autofirma. La firma CMS y el certificado no se guardan ni se registran; un test firma un CMS real con un marcador y comprueba que no aparece en la respuesta ni en la consola.

### R-05 · Bajo — Constructor sin comprobación de dirección cero y NatSpec obsoleto

El constructor aceptaba la dirección cero como verificador o relayer, lo que dejaba un contrato inutilizable sin aviso. El NatSpec de `votarManual` describía la vía manual ya retirada.

**Corrección:** error `DireccionCero` en el constructor, con test; NatSpec y cabecera actualizados. También se regenera el ABI de la web, que no incluía `_relayer` ni `SoloRelayer`.

## Privilegios y cambios sobre elecciones

- No hay funciones de administrador, `owner`, pausa o setters para modificar votos, fechas, opciones o contenido después de crear una propuesta. `crearPropuesta` solo la puede invocar el relayer inmutable; apertura/cierre quedan fijadas al crearla.
- Los votos registrados no tienen función de edición o borrado. La opción se conserva en el mapping y el total se incrementa al registrar ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L151), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L154)). Esto protege contra modificación posterior por un administrador, pero no soluciona la admisión de votos no elegibles (C-01).
- Las opciones son un enum fijo (`A favor`, `En contra`, `Abstención`) ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L22)).
- La API limita la creación por IP y el contrato la restringe al relayer (M-04, sin clave en la demo). La ausencia de administrador on-chain no equivale a un proceso de aprobación pública o deliberativa.

## Respuestas directas

1. **Nullifier:** la vía manual de UI/API se eliminó en Fase 0. Certificado = HMAC con secreto del servidor sobre la propuesta y el DNI normalizado (R-02, R-03); si no hay DNI válido, se rechaza. ZK = identificador del verificador bajo `civora-voto-<propuesta>`. Los espacios entre certificado y ZK siguen sin vincularse. No se puede confirmar desde este repositorio la equivalencia DNI/pasaporte interna del SDK.
2. **Separación identidad-voto:** ZK evita revelar directamente identidad al contrato, pero no usa registro de compromiso en árbol Merkle. Certificado sí permite al backend enlazar identidad y voto. La vía manual no demuestra identidad.
3. **Gas y vinculación:** paga el relayer del servidor; el votante no aporta wallet. La dirección relayer es pública. IP puede correlacionarse en infraestructura web; no se verificó la retención del hosting.
4. **Administrador:** no hay funciones para pausar o alterar una elección/votos ya creada. La API ya no exige `ADMIN_SECRET` en la demo (M-04) y el contrato limita la creación al relayer inmutable.
5. **Resultados y cifrado:** la aplicación no devuelve recuentos antes del cierre. Los votos no están cifrados; opción y nullifier se publican en cadena y se pueden consultar directamente.
6. **Censo:** no existe raíz Merkle congelada ni prueba de pertenencia a censo.
7. **Terceros:** sin analítica/píxeles detectados; las fuentes se sirven con `next/font` y hay CSP con nonce. El SDK/servicio ZKPassport y JavaScript same-origin de Autofirma aún requieren control de suministro/privacidad.
8. **Slither/Foundry/tests:** Slither y `forge` no están instalados y no hay configuración Foundry detectada. La suite Hardhat se ejecuta después de reinstalar dependencias con `pnpm install --frozen-lockfile --config.confirmModulesPurge=false`; las pruebas añadidas cubren además configuración, autorización y web. No se atribuyen hallazgos de Slither.

## Verificación realizada

- Revisión estática de rutas, contrato, frontend, paquetes y documentación señalados arriba.
- `Get-Command slither, forge`: sin ejecutables encontrados; paquete de contratos sin configuración Foundry.
- `pnpm install --frozen-lockfile --config.confirmModulesPurge=false`: completado; lockfile sin cambios.
- `pnpm --filter @civora/contracts test`: 18 pruebas superadas.
- `pnpm --filter web test`: 7 pruebas superadas.

Revisión externa R-01 a R-05 (2026-10-06):

- `pnpm --filter @civora/contracts test`: 20 pruebas superadas.
- `pnpm --filter web test`: 27 pruebas superadas.
- `pnpm --filter web typecheck` y `build`: sin errores.
- `pnpm --filter web test:e2e`: 32 pruebas superadas.
- Los mismos pasos que `.github/workflows/ci.yml`, en un clon limpio sin `.env.local` ni despliegue generado: en verde.
