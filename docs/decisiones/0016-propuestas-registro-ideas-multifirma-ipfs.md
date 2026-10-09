# 0016. Propuestas con registro de ideas, multifirma e IPFS

- **Estado:** aceptada (diseño; sin implementar). Decisiones del responsable del 2026-10-07 incorporadas ([al final](#decisiones-del-responsable-2026-10-07))
- **Fecha:** 2026-10-07
- **Sustituirá, al aceptarse:** la creación de propuestas por `POST /api/propuestas` y el relayer ([ADR 0004](0004-relayer-inmutable.md), solo en lo relativo a `crearPropuesta`)
- **Cierra:** M-04 de la [auditoría](../auditoria-seguridad.md#m-04--medio--creación-de-propuestas-sin-autorización-riesgo-aceptado-en-la-demo)
- **Relacionada:** [ADR 0013](0013-postgres-en-el-vps.md), [ADR 0014](0014-opcion-vinculada-prueba-zk.md), [ADR 0017](0017-servicios-por-frontera-de-confianza.md)

## Contexto

Hoy cualquiera crea una propuesta con `POST /api/propuestas`, sin clave y con
un límite de 5 por IP cada 15 minutos en memoria
([`apps/web/app/api/propuestas/route.ts`](../../apps/web/app/api/propuestas/route.ts)).
El servidor escribe el contenido en `civora-db` y llama a
`VotacionAnonima.crearPropuesta` con el relayer, que paga el gas
([`apps/web/lib/propuestas-store.ts`](../../apps/web/lib/propuestas-store.ts)).
Tres problemas:

1. **M-04:** no hay autorización. El gasto del relayer y el contenido del
   listado dependen de un límite por IP que se elude cambiando de IP.
2. **El servidor decide qué se vota.** No hay ningún paso público ni
   verificable entre «alguien propone» y «se abre la votación».
3. **El contenido solo vive en `civora-db`.** El contrato guarda
   `keccak256(JSON)`: si se pierde el volumen (sin copias,
   [ADR 0013](0013-postgres-en-el-vps.md)), el hash permite comprobar una copia,
   pero no recuperarla.

### Qué se ha estudiado

Se han revisado los repositorios de
[spain-in-parallel](https://github.com/spain-in-parallel) en estos commits:
`registry` e9b2ccd, `gateway` a74caad, `deployed-contracts` b94c07d,
`council-dao` 76188d7 y `app` 182a29d (2026-07/08). Lo relevante para esta
decisión:

- **`registry/contracts/IdeaRegistry.sol`**:
  - `submit(cid)` es abierto y retiene un depósito `>= fee` (líneas 113-118).
  - `resolve(id, approve, config)` es `onlySafe` (líneas 129-160). Al
    aprobar exige `config.description == idea.cid` (línea 141), sobrescribe
    `startTimestamp` con `block.timestamp` (línea 146) y llama a
    `createProposal` en el contrato de destino, cuyo id lee después con
    `lastProposalId()` (líneas 147-148).
  - Al rechazar retiene `base` y el resto queda reclamable (líneas 152-156).
  - Los pagos son *pull*: `owed` y `claim()` (líneas 163-170).
  - `setConfig` es `onlySafe` y puede cambiar el Safe, la tesorería, el
    contrato de destino, `fee` y `base` sin espera (líneas 176-189).
  - El contrato no es actualizable (UUPS), pero `setConfig` le da poder
    para cambiar todo eso.
- **`registry/test/IdeaRegistry.t.sol`**: 20 tests en Foundry, con un
  invariante de solvencia (línea 272) y fuzzing del rechazo (línea 291).
- **`deployed-contracts/06-ProposalsState/ProposalsState.sol:121`**:
  `createProposal` no está restringido. Cualquiera con `minFundingAmount`
  crea propuestas en el contrato de destino. La lista «oficial» es
  `promotedProposalIds()` del registro, que es una lista de visualización,
  no un control de acceso.
- **`council-dao/idea-v1.md`**: formato JSON de la idea. Dice que el
  contrato no garantiza que la configuración (duración, opciones) coincida
  con el contenido del CID: lo garantiza el hash que aprueba el Safe
  («Integrity is guaranteed by the Safe's approved hash, not by
  `IdeaRegistry`»).
- **`council-dao/index.html:300` y `:401`**, y **`app/utils/proposal-contact.ts:41`**:
  descargan el JSON de pasarelas IPFS públicas (`ipfs.io`, `dweb.link`,
  `w3s.link`, `ipfs.rarimo.com`) **sin recalcular el CID**. Confían en la
  pasarela.
- **`deployed-contracts/09-IdeaRegistry/README.md`**: el IdeaRegistry
  desplegado se declara idéntico al código fuente, pero no se comparó su
  bytecode con el de la cadena.

## Decisión propuesta

Un contrato propio, **`RegistroIdeas`**, inspirado en `IdeaRegistry` pero
sin copiar su código. Las propuestas pasan por tres pasos: cualquiera
propone, una multifirma (Safe) aprueba o rechaza, y la aprobación crea la
votación de forma atómica en `VotacionAnonima`. El contenido se publica en
IPFS y su CID queda en cadena.

### 1. Contratos

**`VotacionAnonima` (nueva versión, con redespliegue):**

- Nuevo `address public immutable registroIdeas`. `crearPropuesta` solo
  acepta llamadas de esa dirección (`SoloRegistro`). El relayer deja de poder
  crear propuestas; sigue siendo el único que puede llamar a `votarManual`
  hasta la [Fase 1](../ROADMAP.md#fase-1-semaphore).
- Interfaz de destino, mínima y con nombres de Civora:

  ```solidity
  interface IDestinoVotacion {
      /// propuestaIdTexto: identificador que se usará en el ámbito ZK (ADR 0014).
      /// cid: CID del contenido; sustituye a contenidoHash.
      function crearPropuesta(string calldata propuestaIdTexto, string calldata cid,
                              uint64 apertura, uint64 cierre) external;
  }
  ```

  A diferencia de `IProposalsState`, no hay `lastProposalId()`: el
  identificador lo fija el registro, así que no hay que leerlo después.
- **Dependencia circular de direcciones:** las dos direcciones son
  inmutables y cada contrato necesita la del otro. Se despliega
  `VotacionAnonima` con la dirección futura del registro, calculada con
  `getCreateAddress(desplegador, nonce + 1)`. Después se despliega el
  registro y se comprueba la dirección, o el despliegue falla. Así no hace
  falta un `fijarDestino` de un solo uso.

**`RegistroIdeas`:**

- `proponer(string cid) payable returns (uint256 id)`:
  - Abierto a cualquiera y exige `msg.value >= deposito`.
  - Valida que el CID tiene el formato del [punto 3](#3-ipfs), CIDv1
    `raw` con `sha2-256`, para que la web pueda recalcularlo.
- `resolver(uint256 id, bool aprobar, uint64 apertura, uint64 duracion)`,
  solo el Safe:
  - **El CID no viaja en la llamada:** el registro pasa `idea.cid` al
    destino. Desaparece la clase de error `CidMismatch` (línea 141 del
    original).
  - `propuestaIdTexto` se deriva en cadena del registro y del número de idea
    (por ejemplo, `<chainId>-<registro>-<id>`), para que no colisione entre
    despliegues ni entre redes. El formato exacto se cierra al implementarlo,
    junto con `packages/zk-identity`.
  - Exige `apertura >= block.timestamp` y una duración entre
    `duracionMinima` y `duracionMaxima`. Las dos son inmutables, se fijan
    al desplegar y son independientes de la espera para cambiar el Safe
    (ver [Duración de las votaciones](#duración-de-las-votaciones)).
  - Al rechazar retiene `base` y el resto queda reclamable, con pagos *pull*
    como en el original (`claim()`).
- `retirarContenido(uint256 id, string motivo)`, solo el Safe: emite
  `ContenidoRetirado(id, motivo)` para dejar constancia pública de que una
  propuesta aprobada deja de fijarse (ver [Borrado](#3-ipfs)). **No toca la
  votación**: no hay nada en `VotacionAnonima` que pueda tocar.
- **`setConfig` limitado** (ver [Inmutabilidad](#encaje-con-la-inmutabilidad)).

### 2. Quién es el Safe

| Entorno | Safe | Umbral | Quién firma |
|---|---|---|---|
| Entorno de pruebas actual (Sepolia) | Safe oficial en Sepolia | **1 de 1, declarado abiertamente** | Solo el responsable de Civora. El README y la página `/consejo` lo dicen: hoy una sola persona decide qué se vota, igual que con la clave de administración de la Fase 0, pero en cadena y de forma pública |
| Producción en VPS dedicado (Base) | Safe de la administración convocante | 3 de 5, por ejemplo | Personas de órganos distintos (secretaría, junta o mesa, oposición, observador independiente). **Nunca el operador técnico**; NexuraIA no debe poder aprobar propuestas |

**Criterio para pasar de 1 de 1 a 2 de 3 en pruebas:** en cuanto haya dos
firmantes externos a NexuraIA, cada uno con su propia cartera en un
dispositivo que solo controla él, y que hayan aceptado revisar las ideas
pendientes. El responsable queda como uno de los tres. No se pasa a 2 de 3
con claves de la misma persona o guardadas en el mismo equipo. El cambio se
anota en el README y en
[despliegue-produccion.md](../despliegue-produccion.md).

- **Cambiar los propietarios no cambia la dirección del Safe.** Se hace
  dentro del propio Safe (`addOwnerWithThreshold`), así que no pasa por
  `RegistroIdeas` ni por su espera. Es inmediato y queda en cadena como
  evento.
  - En pruebas es aceptable.
  - En producción, un módulo de retardo sobre el Safe (por ejemplo, Zodiac
    Delay) daría a los cambios de propietarios la misma espera que el
    cambio de Safe.

- Los firmantes revisan en la web de Civora (página `/consejo`, solo
  lectura) y firman en la app oficial de Safe o con `approveHash`, como
  `council-dao`.
- La configuración que aprueban se deriva siempre igual del JSON del CID.
  Así, cualquiera puede reconstruir la transacción y comprobar que coincide
  con el hash que firmó el Safe (`council-dao/idea-v1.md`, «Mapping to
  `ProposalConfig`»).

### 3. IPFS

- **Formato:** **CIDv1, códec `raw`, `sha2-256`**, en un solo bloque. El
  JSON se limita a 64 KiB.
  - Comprobarlo es calcular `sha256(bytes)` y compararlo con el *multihash*
    del CID, sin trocear en UnixFS ni dependencias.
  - Se haría en `apps/web/lib/cid.mjs`, con tests en `node --test`. En el
    navegador basta `crypto.subtle`.
- **Contenido:** esquema `propuesta/v2` en `packages/shared-types`: título,
  descripción, pregunta, duración en días y elegibilidad. Igual que en
  `idea-v1`, **sin datos personales**: es público y permanente.
- **Dónde se fija (pinning):**

  | Copia | Entorno de pruebas actual (VPS compartido) | Producción en VPS dedicado |
  |---|---|---|
  | Bytes en Postgres (caché y fuente para la web) | sí, `civora-db` sin copias de seguridad ([ADR 0013](0013-postgres-en-el-vps.md)) | sí, con copias de seguridad automáticas y probadas, y TLS o red aislada |
  | **Pinata** (principal) | sí | sí |
  | **Filebase** (respaldo) | sí | sí |
  | Nodo IPFS propio (Kubo), tercera copia | **no** (ver motivo) | sí |

  - **Motivo para no tener nodo propio en pruebas:** Kubo consume entre 300
    y 500 MB y abre el puerto 4001 a la red P2P. Eso es incompatible con un
    VPS compartido con el n8n de producción
    ([ADR 0011](0011-alojamiento-vps-propio.md)). En el VPS dedicado sí
    cabe, y da una copia que no depende de terceros.
  - **Por qué Filebase de respaldo y no Storacha:**
    - API compatible con S3, con credenciales por *bucket*, sin cliente
      propio.
    - Importa archivos CAR (`import=car`), así que conserva exactamente
      nuestro CID, y lo devuelve en `x-amz-meta-cid` para compararlo
      ([documentación](https://filebase.com/docs/ipfs/pinning/pinning-files)).
    - Admite la Pinning Service API estándar, que facilita migrar los pins.
    - Storacha exige delegaciones UCAN y su propio cliente
      ([documentación](https://docs.storacha.network/concepts/ucans-and-storacha)),
      más complejidad para una copia de respaldo. Además, el servicio ya
      cambió de API y de nombre al pasar de web3.storage a Storacha.
    - Ninguno de los dos está en la UE. Es aceptable porque el contenido es
      público y no puede llevar datos personales.
  - **El CID lo calcula Civora, no el proveedor:**
    - Cada subida se hace como CAR con nuestro bloque.
    - Si el CID que devuelve el proveedor no coincide con el calculado, la
      subida falla.
    - Al implementar hay que confirmar cómo sube Pinata un CAR con su API
      v3. Si no conserva el CID, se fija por CID (*pin by CID*) a partir de
      la copia de Filebase.
  - **Credenciales:** variables de entorno con permiso solo de escritura en
    un *bucket* o grupo propio. Nunca en código.
  - **Regla:** el Safe solo aprueba si el CID está fijado en los dos
    proveedores. La página `/consejo` lo comprueba y lo muestra.
- **Cómo lo verifica la web:**
  - Lee el CID del contrato.
  - **Fuentes:** la copia de `civora-db` y varias pasarelas IPFS (la del
    proveedor principal, la de respaldo y al menos dos públicas, por
    ejemplo `ipfs.io` y `dweb.link`). La lista se configura con variables de
    entorno.
  - **Todas se verifican contra el CID**, incluida `civora-db`. El servidor
    las prueba en orden y recalcula el CID de cada respuesta. Si no
    coincide, ese contenido **no se muestra nunca**, se registra un aviso
    (código corto, sin el contenido) y se prueba la siguiente fuente.
  - Es justo lo que no hacen `council-dao` ni `app`, que se fían de la
    pasarela.
  - El navegador repite la comprobación con `crypto.subtle` sobre los bytes
    que recibe de `/api/contenido/<cid>`, del mismo origen y sin tocar la
    CSP.
  - Un tercero que no confíe en el servidor la reproduce con el script de
    auditoría ([ROADMAP](../ROADMAP.md#intenta-hacer-trampa-y-script-de-auditoría)).
- **Si ninguna fuente devuelve contenido válido:**
  - Puede ser porque nadie responde o porque todas devuelven contenido que
    no coincide.
  - La web avisa de que el contenido no está disponible, muestra el CID y
    **deja votar**. Retirar o falsificar el contenido nunca detiene una
    votación. La votación sigue funcionando en cadena: las opciones son un
    enum fijo y el CID ya está fijado en el contrato.
  - Cualquiera que conserve el JSON (la web lo ofrece para descargar al
    proponer y al votar) puede volver a fijarlo; el CID demuestra que es el
    original.
  - Es una mejora clara sobre hoy: el hash `keccak256` no dice dónde buscar
    el contenido; el CID sí.
- **Borrado:**
  - **Ideas pendientes o rechazadas:** se pueden dejar de fijar en las
    copias propias, por ejemplo si tienen datos personales o contenido
    ilícito.
  - **Propuestas aprobadas:** no se dejan de fijar **salvo por una decisión
    pública del Safe en cadena con su motivo**, por ejemplo una
    transacción del Safe que emite un evento `ContenidoRetirado(id, motivo)`
    en `RegistroIdeas`, **o por orden judicial**, que se anota igualmente.
  - En cualquier caso, **la votación sigue**. El CID queda en cadena, pero
    sin nadie que lo sirva no se puede leer.
  - Que el contenido sea permanente obliga a decirlo así en el formulario.

### 4. Quién paga qué

| Acción | Quién la envía | Gas | Depósito |
|---|---|---|---|
| Proponer con cartera | Proponente | Proponente | Proponente (se le devuelve `deposito - base` si se rechaza) |
| Proponer sin cartera | Relayer, por la web | Relayer, dentro del subtope de ideas y aprobaciones | Relayer; las devoluciones vuelven al relayer |
| Firmar (`approveHash` o firma fuera de cadena) | Cada firmante | Firmante (o nada, si firma fuera de cadena) | — |
| Ejecutar la aprobación o el rechazo (`execTransaction`) | Relayer, cuando hay quórum | Relayer, dentro del subtope de ideas y aprobaciones | — |
| Votar | Relayer | Relayer, con la reserva para votos | — |

- Los depósitos aprobados y el `base` de los rechazados van a la tesorería.
  En pruebas, la tesorería es la propia cartera del relayer, para que se
  autofinancie.
- **Proponente sin cartera:** es lo habitual en pruebas. Mientras no exista
  el servicio de identidad ([ADR 0017](0017-servicios-por-frontera-de-confianza.md)),
  el relayer solo envía `proponer` con dos límites:
  - el límite por IP actual;
  - un **tope global de 20 ideas al día** retransmitidas.
- Con el servicio de identidad, el tope pasa a ser **una idea por persona
  verificada y semana**, sin dejar de respetar el tope global. El servicio
  lo lleva con un HMAC por periodo, como el nullifier de certificado.
- En pruebas, el dinero no frena el spam: el ETH de Sepolia es gratis. Lo
  frenan el tope del relayer y la revisión del Safe; el spam se queda en la
  cola y nunca llega a votación.

**Importes decididos.** Todos se pueden cambiar sin redesplegar contratos ni
reconstruir imágenes:

| Parámetro | Valor | Dónde vive | Cómo se cambia |
|---|---|---|---|
| Depósito (`deposito`) | 5 € | `RegistroIdeas`, en wei | `setConfig` del Safe, con el tope inmutable `depositoMaximo` (equivalente a 50 € al desplegar) |
| No reembolsable (`base`) | 2 € | `RegistroIdeas`, en wei | `setConfig` del Safe; cada idea guarda el `base` vigente al proponerla |
| Ideas sin cartera al día | 20 | Servicio `relayer` (`IDEAS_SIN_CARTERA_POR_DIA`) | Variable de entorno y reinicio del servicio |
| Gasto total del relayer | 10 € al día | Servicio `relayer` (`TOPE_GASTO_DIARIO_EUR`) | Variable de entorno y reinicio del servicio |
| Reserva para votos | 8 € de los 10 € | Servicio `relayer` (`RESERVA_VOTOS_EUR`) | Variable de entorno y reinicio del servicio |
| Subtope de ideas y aprobaciones | 2 € (el resto) | Calculado: tope total menos reserva | Al cambiar cualquiera de los dos anteriores |

- **De euros a wei:**
  - El depósito se convierte al precio del día y el Safe lo actualiza
    con `setConfig` si el precio del ETH se desvía más de un 20 %.
  - El relayer convierte su tope con `PRECIO_ETH_EUR`, una variable
    actualizada a mano. No se usa un oráculo de precios, para no añadir una
    dependencia externa al camino del voto.
  - En Sepolia los importes son nominales.
- **Presupuesto del relayer:** las ideas sin cartera y las aprobaciones
  (`execTransaction`) no pueden dejar sin gas a las votaciones abiertas.
  - **Ideas y aprobaciones** solo gastan su subtope de 2 € al día. Al
    agotarlo se rechazan hasta el día siguiente (UTC); los votos siguen.
  - **Votos:** gastan primero el subtope sin usar y después la reserva de
    8 €. Solo se rechazan si se agota el tope total.
- **Alerta:** en cuanto un voto empieza a consumir la reserva, el relayer
  registra un aviso con `lib/registro.mjs` (código corto, sin datos). Si
  `ALERTA_GASTO_URL` está definida, también hace un POST con el gasto
  acumulado, la reserva restante y el tope. Ese destino puede ser, por
  ejemplo, un flujo de n8n. Se avisa también al agotar el subtope y al
  agotar el tope total.
- **Relayer** ([ADR 0017](0017-servicios-por-frontera-de-confianza.md)):
  su lista blanca añade `RegistroIdeas.proponer` y `Safe.execTransaction`
  (solo sobre el Safe configurado) y quita `crearPropuesta`.

### 5. Impacto en la web, la base de datos y la experiencia

- **Web:**
  - `/propuestas/nueva` construye el JSON, calcula el CID en el navegador,
    sube los bytes (a `civora-db` y a los pins) y envía `proponer`, con
    cartera o por el relayer.
  - `/propuestas` lista desde los eventos del contrato: pendientes,
    aprobadas y rechazadas.
  - `/consejo` es una página de solo lectura para los firmantes.
  - `/votar/<id>` muestra el contenido solo si coincide con el CID. Si
    ninguna fuente lo devuelve válido, avisa, muestra el CID y deja votar.
- **Base de datos:** deja de ser la fuente de verdad y pasa a ser **caché**
  de bytes por CID y de eventos. Si se pierde, se reconstruye desde la
  cadena y el pinning. La tabla `propuestas` actual queda para las
  propuestas archivadas de contratos anteriores.
- **Experiencia:** proponer deja de ser inmediato. La idea queda
  «Pendiente de aprobación» hasta que el Safe la resuelve, y puede tardar
  días. Hay que decirlo en el formulario y en el listado.

## Alternativas

- **Mantener `ADMIN_SECRET`** (estado de la Fase 0):
  - Es simple y no cambia el contrato.
  - Pero vuelve a una sola clave compartida, que ya se filtró una vez
    (M-04). El servidor sigue decidiendo qué se vota y el contenido sigue
    solo en `civora-db`.
  - Solo sirve como medida provisional.
- **`IdeaRegistry` tal cual:**
  - La licencia GPL-3.0 es compatible, y ya existe con tests.
  - Pero su destino tiene la forma `IProposalsState` (ids con contador,
    `ProposalConfig` con listas de votación de Rarimo). Con
    `VotacionAnonima` exigiría un adaptador o cambiar el contrato entero.
  - Además arrastra el `setConfig` sin límites y pasa el CID como
    parámetro en vez de leerlo del registro.
- **Versión propia inspirada (elegida):** mismo flujo y mismos pagos
  *pull*, con interfaz de Civora, destino inmutable, CID leído del registro y
  `setConfig` limitado. Cuesta un contrato nuevo y sus tests. Como no se
  copia código, no hay obligaciones de licencia por el diseño, y el
  contrato puede seguir siendo GPL-3.0 como `VotacionAnonima`.

## Encaje con la inmutabilidad

Los ADR vigentes eligen inmutabilidad: relayer `immutable`
([ADR 0004](0004-relayer-inmutable.md)), `devModeZk` inmutable
([ADR 0010](0010-demo-publica-testnet.md)) y ninguna función de
administrador en `VotacionAnonima`. `IdeaRegistry` no es UUPS, pero su
`setConfig` (líneas 176-189) permite al Safe, en una sola transacción y sin
espera, hacer lo siguiente:

| Poder | Riesgo | Propuesta para `RegistroIdeas` |
|---|---|---|
| Cambiar `proposals` (el contrato de destino) | Mandar las aprobaciones futuras a otro contrato | **Inmutable.** `VotacionAnonima` solo acepta este registro; cambiar de destino es desplegar los dos |
| Cambiar `safe` | Ceder todo el control de golpe | Permitido con **espera de 7 días** y evento: propuesta, ejecución y cancelación. Sirve para dar tiempo público para detectar un intento de tomar el control del consejo. No protege las votaciones abiertas, que no dependen del Safe (ver abajo). Si se pierden las claves del Safe, no hay recuperación: desplegar de nuevo |
| Cambiar `fee` | Subirla tanto que nadie pueda proponer (censura) | Con **tope inmutable** `depositoMaximo` |
| Cambiar `base` | Quedarse con más depósito de los rechazados | Limitado por `deposito` y fijado en cada idea al proponer (no se aplica con efecto retroactivo) |
| Cambiar `treasury` | Desviar comisiones futuras | Permitido. Lo ya acumulado sigue siendo de la tesorería anterior (`owed`) |

Con esto, el único poder del Safe sobre lo que se vota es aprobar o rechazar
cada idea, y ese es justo el que se le quiere dar. Ni el Safe ni el
operador pueden cambiar una propuesta ya creada.

### Comprobación: nada en cadena afecta a una votación ya creada

| Vía | Por qué no afecta |
|---|---|
| Volver a crear la misma propuesta | `crearPropuesta` rechaza un identificador existente, y el identificador sale del registro y del número de idea, que no se repite |
| Cambiar fechas, CID, recuentos o nullifiers | `VotacionAnonima` no tiene funciones de administrador ni de modificación |
| Deshacer una aprobación | `Approved` y `Rejected` son estados finales en `RegistroIdeas` |
| `setConfig` | Solo cambia tesorería, depósito y `base`. El destino es inmutable |
| Cambiar de Safe | El Safe nuevo solo puede aprobar ideas nuevas |
| `retirarContenido` | Solo emite un evento |
| Votar | `votarConPruebaZk` solo exige una prueba válida, y `votarManual` solo el relayer. Ninguno consulta el registro ni el Safe |

Por eso no se añaden reglas que liguen la espera a la duración de las
votaciones. Fuera de la cadena sí hay dos vías, que este diseño mitiga:

- **Dejar de fijar el contenido:** se mitiga con la regla de
  [Borrado](#3-ipfs) para propuestas aprobadas, y porque sin contenido
  verificado la web **sigue dejando votar**.
- **Agotar el gas del relayer con ideas o aprobaciones:** se mitiga con la
  reserva para votos ([Quién paga qué](#4-quién-paga-qué)).

Las dos están en el
[modelo de amenazas](../modelo-amenazas.md#vías-fuera-de-cadena-sobre-votaciones-abiertas-adr-0016).

### Duración de las votaciones

`duracionMinima` y `duracionMaxima` son inmutables, se fijan en cada
despliegue y son independientes de la espera del Safe.

| Despliegue | Mínimo | Máximo |
|---|---|---|
| Entorno de pruebas | 1 hora | 90 días |
| Producción en VPS dedicado | 1 hora por defecto; **probablemente 24 horas**, porque es lo que exigirá un organismo convocante | 90 días |

- **Mínimo de 1 hora:**
  - Basta para probar el ciclo completo, incluidos los resultados tras el
    cierre.
  - Por debajo, la generación de la prueba ZK en el móvil, la confirmación
    de la transacción y la latencia del relayer dejan poco margen real para
    votar.
  - Un organismo exigirá probablemente al menos 24 horas, para que nadie
    quede fuera por su horario. Se decide al desplegar en producción.
- **Máximo de 90 días:**
  - Cubre consultas largas, como presupuestos participativos.
  - Los resultados están ocultos hasta el cierre (M-01), y más de 90 días
    de opacidad es difícil de justificar.
  - Un contrato vive mientras no cambien el relayer, el dominio ni el
    verificador de ZKPassport, y todos esos cambios obligan a redesplegar.
    Una votación más larga corre más riesgo de quedarse huérfana a medias.
  - El formulario, que hoy admite 365 días, baja a 90.

## Riesgos

- **Pérdida de quórum en el Safe:** no se crean propuestas nuevas, pero las
  existentes siguen. Hay que custodiar claves con dispositivos separados y,
  en producción, tener firmantes suplentes.
- **Colusión o censura de los firmantes:** el Safe puede rechazarlo todo.
  Se mitiga con transparencia: rechazos públicos en cadena y motivo publicado
  junto a la idea. Es un problema de gobierno, no técnico.
- **Disponibilidad del contenido:** depende de dos sitios de pinning. Es
  mejor que hoy, pero no es un archivo garantizado.
- **Contenido ilícito o con datos personales:** el Safe lo rechaza y se deja
  de fijar. Si ya estaba aprobado, solo se retira por decisión pública del
  Safe o por orden judicial, y la votación sigue. El CID queda en cadena
  (ver [Borrado](#3-ipfs)).
- **Dependencia del contrato Safe:** se usa la versión oficial desplegada,
  verificada byte a byte ([ROADMAP](../ROADMAP.md#paso-a-producción)).
- **Experiencia:** la latencia de aprobación puede frustrar la demo. La web
  muestra el estado de cada idea.
- **Redespliegue:** cambia `VotacionAnonima`, así que las propuestas
  actuales se archivan ([AGENTS.md](../../AGENTS.md#reglas-de-trabajo)).
- **Duración fija por despliegue:** cambiar el mínimo o el máximo exige
  redesplegar los dos contratos.
- **Un solo firmante en pruebas:** con el Safe 1 de 1, la aprobación es
  pública y queda en cadena, pero no es colegiada. Se declara así hasta
  cumplir el [criterio de 2 de 3](#2-quién-es-el-safe).

## Consecuencias

- M-04 se cierra: crear una votación exige la aprobación de la multifirma
  en cadena.
- El relayer deja de crear propuestas. Su lista blanca cambia
  ([ADR 0017](0017-servicios-por-frontera-de-confianza.md)).
- `civora-db` pasa a ser caché. Perderla deja de perder contenido.
- Cambian los tipos compartidos (`propuesta/v2` con CID) y el formato de
  `propuestaIdTexto`. Hay que revisar `packages/zk-identity` y el ámbito ZK
  ([ADR 0014](0014-opcion-vinculada-prueba-zk.md)).
- Hace falta verificar el bytecode de tres contratos: `VotacionAnonima`,
  `RegistroIdeas` y el Safe
  ([ROADMAP](../ROADMAP.md#paso-a-producción)).

## Criterios de aceptación

- **Contrato** (tests de Hardhat):
  - `crearPropuesta` solo acepta el registro; el relayer recibe
    `SoloRegistro`.
  - `proponer` exige el depósito y rechaza CID mal formados.
  - `resolver` solo lo puede llamar el Safe. Al aprobar crea la propuesta
    con `idea.cid` en la misma transacción y no admite resolver dos veces.
  - Al rechazar retiene `base` y el resto queda reclamable.
  - `claim` es *pull* y cumple el invariante de solvencia: saldo del
    contrato ≥ depósitos pendientes + `owed`.
  - El destino es inmutable, `safe` solo cambia tras la espera y el
    depósito no supera `depositoMaximo`.
  - `resolver` rechaza duraciones fuera de `duracionMinima` y
    `duracionMaxima`.
  - Un cambio de Safe solo se ejecuta tras 7 días y se puede cancelar,
    con eventos.
  - `retirarContenido` solo lo puede llamar el Safe y no modifica nada de
    `VotacionAnonima`.
  - Un test recorre las vías de la comprobación anterior y demuestra que
    ninguna altera una propuesta ni sus votos.
- **Despliegue:** el script falla si la dirección del registro no coincide
  con la que se fijó en `VotacionAnonima`.
- **Web** (`node --test` y E2E):
  - `lib/cid.mjs` acepta el CID correcto y rechaza bytes alterados.
  - Una fuente que devuelve contenido alterado no se muestra nunca y se
    prueba la siguiente (test con fuentes simuladas).
  - Si ninguna fuente devuelve contenido válido, `/votar/<id>` avisa,
    muestra el CID y **deja votar** (E2E).
  - El listado sale de los eventos.
  - Axe sin infracciones en `/propuestas/nueva` y `/consejo`, a 375 y
    1280 px.
- **Pinning:** el CID que devuelven Pinata y Filebase coincide con el
  calculado; si no coincide, la subida falla (test con un proveedor
  simulado).
- **Relayer** (tests):
  - Aplica el tope de 20 ideas al día sin cartera.
  - Al agotar el subtope de 2 €, rechaza ideas y aprobaciones, pero sigue
    aceptando votos.
  - Avisa en cuanto un voto empieza a consumir la reserva de 8 €.
  - Solo rechaza votos al agotar el tope total de 10 €.
- **Operación:**
  - El Safe 1 de 1 de pruebas está desplegado, anotado en
    [despliegue-produccion.md](../despliegue-produccion.md) y declarado en
    el README y en `/consejo`.
  - Pinata y Filebase están configurados con credenciales solo de
    escritura en las variables del servicio.
  - Se ha probado que, tras borrar `civora-db`, la web reconstruye las
    propuestas desde la cadena y el pinning.
- **Documentación:** M-04 cerrado en la auditoría, y tabla de garantías y
  modelo de amenazas actualizados.

## Decisiones del responsable (2026-10-07)

1. **Safe de pruebas:** 1 de 1, declarado abiertamente. Pasa a 2 de 3
   cuando haya dos firmantes externos
   ([criterio](#2-quién-es-el-safe)).
2. **Importes:** depósito de 5 € (2 € no reembolsables), 20 ideas al día
   sin cartera y tope del relayer de 10 € al día, con 8 € reservados para
   votos y alerta en cuanto se empieza a consumir la reserva. Todo se puede
   cambiar sin redesplegar ([tabla](#4-quién-paga-qué)).
3. **Pinning:** Pinata como principal y Filebase como respaldo
   ([justificación](#3-ipfs)). En producción, en el VPS dedicado, se añade
   un nodo Kubo propio como tercera copia.
4. **Espera para cambiar el Safe:** 7 días, con evento y cancelación, para
   dar tiempo público para detectar un intento de tomar el control del
   consejo. Corregido el mismo día: se retiran la condición «espera mayor
   que la duración máxima» y el bloqueo de votaciones durante un cambio
   pendiente, porque no protegían nada
   ([comprobación](#comprobación-nada-en-cadena-afecta-a-una-votación-ya-creada)).
5. **Entornos:** `civora.nexuraia.com` y el VPS compartido son el entorno
   de pruebas. La producción irá en un VPS exclusivo con dominio propio,
   junto con el paso a Base y el redespliegue de los contratos
   ([ROADMAP](../ROADMAP.md#servicios-propuestas-y-red-principal)). Los
   dominios se leen siempre de la configuración.
6. **Duración de las votaciones:** de 1 hora a 90 días, inmutable por
   despliegue. En producción, probablemente un mínimo de 24 horas
   ([duración](#duración-de-las-votaciones)).
7. **Vías fuera de cadena:**
   - Una propuesta aprobada solo deja de fijarse por decisión pública del
     Safe o por orden judicial, y la votación sigue.
   - La web verifica cada fuente contra el CID y, si ninguna devuelve
     contenido válido, deja votar.
   - El relayer reserva 8 € para votos.
