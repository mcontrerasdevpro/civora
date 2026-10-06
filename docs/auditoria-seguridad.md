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
| M-04 | Resuelto en la aplicación | `POST /api/propuestas` exige `ADMIN_SECRET`, usa comparación de tiempo constante y rate limit por IP; el contrato limita la creación al relayer. El rate limit es en memoria por instancia. |

La arquitectura de identidad, el censo verificable y el secreto criptográfico de papeleta quedan fuera de Fase 0 y no se consideran resueltos.

## Accesibilidad y voto asistido (2026-10-06, rama `accesibilidad-voto-asistido`)

Cambios de interfaz sin tocar contratos, identidad ni rutas API:

- **CSP:** se añade `media-src 'self'` para los audios de confirmación; el resto de la política y el nonce no cambian. El modo sencillo no usa scripts inline.
- **Síntesis de voz:** `speechSynthesis` solo con voces `localService`; la opción elegida no pasa nunca por la síntesis, se reproduce con audios propios (provisionales, voz local; se sustituirán por grabaciones profesionales). Detalle en [modelo-amenazas.md](modelo-amenazas.md#inclusión-y-voto-asistido).
- **Confirmación explícita** antes de enviar el voto, en modo normal y sencillo.
- **Reto de certificado caducado (5 min en servidor):** la interfaz avisa y permite firmar de nuevo conservando datos y opción. Eliminar el límite para voto asistido queda pendiente para la Fase 1.
- **CSP de desarrollo:** `next dev` necesita `eval` y sin él las páginas no se hidrataban. `crearCsp` añade `'unsafe-eval'` solo con `NODE_ENV=development`; la política de build/start no cambia. Un test unitario y otro E2E (cabecera real de `next start`) fallan si aparece en producción.

Verificación: `pnpm --filter web test` (15 pruebas), `typecheck`, `build` y `pnpm --filter web test:e2e` (26 pruebas: axe WCAG 2.1 A/AA en cada paso, modo normal y sencillo, 1280 y 375 px).

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

### M-04 · Medio — Creación de propuestas sin autorización (resuelto en la aplicación)

La ruta `POST /api/propuestas` inicialmente carecía de control de acceso. Fase 0 exige `ADMIN_SECRET`, compara con `timingSafeEqual`, aplica rate limit por IP y el contrato permite crear propuestas únicamente al relayer inmutable. El rate limit en memoria no se comparte entre instancias.

**Arreglo propuesto:** restaurar autenticación y autorización en servidor, limitar tasa y validar que la propuesta se aprueba antes de enviar la transacción. No exponer secretos al cliente.

## Privilegios y cambios sobre elecciones

- No hay funciones de administrador, `owner`, pausa o setters para modificar votos, fechas, opciones o contenido después de crear una propuesta. `crearPropuesta` solo la puede invocar el relayer inmutable; apertura/cierre quedan fijadas al crearla.
- Los votos registrados no tienen función de edición o borrado. La opción se conserva en el mapping y el total se incrementa al registrar ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L151), [VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L154)). Esto protege contra modificación posterior por un administrador, pero no soluciona la admisión de votos no elegibles (C-01).
- Las opciones son un enum fijo (`A favor`, `En contra`, `Abstención`) ([VotacionAnonima.sol](../packages/contracts/contracts/VotacionAnonima.sol#L22)).
- La API y el contrato protegen la creación (M-04). La ausencia de administrador on-chain no equivale a un proceso de aprobación pública o deliberativa.

## Respuestas directas

1. **Nullifier:** la vía manual de UI/API se eliminó en Fase 0. Certificado = hash de NIF y propuesta; si no hay NIF, se rechaza. ZK = identificador del verificador bajo `civora-voto-<propuesta>`. Los espacios entre certificado y ZK siguen sin vincularse. No se puede confirmar desde este repositorio la equivalencia DNI/pasaporte interna del SDK.
2. **Separación identidad-voto:** ZK evita revelar directamente identidad al contrato, pero no usa registro de compromiso en árbol Merkle. Certificado sí permite al backend enlazar identidad y voto. La vía manual no demuestra identidad.
3. **Gas y vinculación:** paga el relayer del servidor; el votante no aporta wallet. La dirección relayer es pública. IP puede correlacionarse en infraestructura web; no se verificó la retención del hosting.
4. **Administrador:** no hay funciones para pausar o alterar una elección/votos ya creada. La API exige `ADMIN_SECRET` y el contrato limita la creación al relayer inmutable.
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
