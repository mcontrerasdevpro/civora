# 0016. Propuestas con registro de ideas, multifirma e IPFS

- **Estado:** propuesta (diseño; pendiente de las decisiones del responsable listadas al final)
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
  - Exige `apertura >= block.timestamp`, y la duración entre un mínimo y un
    máximo fijados al desplegar (por ejemplo, entre 1 y 90 días).
  - Al rechazar retiene `base` y el resto queda reclamable, con pagos *pull*
    como en el original (`claim()`).
- **`setConfig` limitado** (ver [Inmutabilidad](#encaje-con-la-inmutabilidad)).

### 2. Quién es el Safe

| Entorno | Safe | Umbral | Quién firma |
|---|---|---|---|
| Demo (Sepolia) | Safe oficial en Sepolia | 2 de 3 | Responsable de Civora y dos personas de NexuraIA, cada una con su propia cartera y dispositivo. Si solo firma el responsable, **mejor 1 de 1 declarado** que un 2 de 3 con las tres claves en las mismas manos |
| Producción (Base) | Safe de la administración convocante | 3 de 5, por ejemplo | Personas de órganos distintos (secretaría, junta o mesa, oposición, observador independiente). **Nunca el operador técnico**; NexuraIA no debe poder aprobar propuestas |

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

  | Copia | Demo | Producción |
  |---|---|---|
  | Bytes en `civora-db` (caché y fuente para la web) | sí | sí |
  | Servicio externo de pinning (Pinata, Filebase o Storacha) con credencial solo de escritura | sí | sí |
  | Nodo IPFS propio (Kubo) | **no** (ver motivo) | sí, en el VPS dedicado |

  - **Motivo para no tener nodo propio en la demo:** Kubo consume entre 300
    y 500 MB y abre el puerto 4001 a la red P2P. Eso es incompatible con un
    VPS compartido con el n8n de producción
    ([ADR 0011](0011-alojamiento-vps-propio.md)).
  - **Regla:** el Safe solo aprueba si el CID está fijado al menos en dos
    sitios. La página `/consejo` lo comprueba y lo muestra.
- **Cómo lo verifica la web:**
  - Lee el CID del contrato.
  - Obtiene los bytes, primero de `civora-db` y, si faltan, de su pinning o
    de una pasarela.
  - Recalcula el CID y **rechaza el contenido si no coincide**, venga de
    donde venga.
  - El navegador repite la comprobación con `crypto.subtle` sobre los bytes
    que recibe de `/api/contenido/<cid>`, del mismo origen y sin tocar la
    CSP.
  - Un tercero que no confíe en el servidor la reproduce con el script de
    auditoría ([ROADMAP](../ROADMAP.md#intenta-hacer-trampa-y-script-de-auditoría)).
- **Si nadie lo fija:**
  - El CID sigue en cadena y la votación sigue funcionando, porque las
    opciones son un enum fijo. Pero nadie puede leer qué se vota.
  - La web muestra «Contenido no disponible» y **no ofrece votar** una
    propuesta cuyo texto no puede verificar.
  - Cualquiera que conserve el JSON (la web lo ofrece para descargar al
    proponer) puede volver a fijarlo; el CID demuestra que es el original.
  - Es una mejora clara sobre hoy: el hash `keccak256` no dice dónde buscar
    el contenido; el CID sí.
- **Borrado:** las ideas rechazadas o con contenido ilícito se dejan de
  fijar en las copias propias. El CID queda en cadena, pero sin nadie que lo
  sirva no se puede leer. Que el contenido sea permanente obliga a decirlo
  así en el formulario.

### 4. Quién paga qué

| Acción | Quién la envía | Gas | Depósito |
|---|---|---|---|
| Proponer con cartera | Proponente | Proponente | Proponente (se le devuelve `deposito - base` si se rechaza) |
| Proponer sin cartera | Relayer, por la web | Relayer | Relayer, con un presupuesto diario fijo; las devoluciones vuelven al relayer |
| Firmar (`approveHash` o firma fuera de cadena) | Cada firmante | Firmante (o nada, si firma fuera de cadena) | — |
| Ejecutar la aprobación o el rechazo (`execTransaction`) | Relayer, cuando hay quórum | Relayer | — |
| Votar | Relayer | Relayer | — |

- Los depósitos aprobados y el `base` de los rechazados van a la tesorería,
  que en la demo es la propia cartera del relayer, para que se
  autofinancie.
- **Proponente sin cartera:** es lo habitual en la demo. Mientras no exista
  el servicio de identidad ([ADR 0017](0017-servicios-por-frontera-de-confianza.md)),
  el relayer solo envía `proponer` con dos límites:
  - el límite por IP actual;
  - un **tope diario global** de ideas retransmitidas (por ejemplo, 20).
- Con el servicio de identidad, el tope pasa a ser **una idea por persona
  verificada y semana**. El servicio lo lleva con un HMAC por periodo,
  como el nullifier de certificado.
- El dinero no es lo que frena el spam en la demo: el ETH de Sepolia es
  gratis. Lo frenan el tope del relayer y la revisión del Safe; el spam se
  queda en la cola y nunca llega a votación.
- **Depósito en producción:** equivalente a unos 5 € (`deposito`), de los
  que 2 € no se devuelven (`base`). Se fija en wei al desplegar. El gas de
  `proponer` en Base es despreciable frente a esa cifra.
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
  - `/votar/<id>` solo se habilita con el CID verificado.
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
| Cambiar `safe` | Ceder todo el control de golpe | Permitido con **espera de 7 días** y evento: propuesta, ejecución y cancelación. Si se pierden las claves del Safe, no hay recuperación: desplegar de nuevo |
| Cambiar `fee` | Subirla tanto que nadie pueda proponer (censura) | Con **tope inmutable** `depositoMaximo` |
| Cambiar `base` | Quedarse con más depósito de los rechazados | Limitado por `deposito` y fijado en cada idea al proponer (no se aplica con efecto retroactivo) |
| Cambiar `treasury` | Desviar comisiones futuras | Permitido. Lo ya acumulado sigue siendo de la tesorería anterior (`owed`) |

Con esto, el único poder del Safe sobre lo que se vota es aprobar o rechazar
cada idea, y ese es justo el que se le quiere dar. Ni el Safe ni el
operador pueden cambiar una propuesta ya creada.

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
  de fijar. El CID queda en cadena (ver [Borrado](#3-ipfs)).
- **Dependencia del contrato Safe:** se usa la versión oficial desplegada,
  verificada byte a byte ([ROADMAP](../ROADMAP.md#paso-a-producción)).
- **Experiencia:** la latencia de aprobación puede frustrar la demo. La web
  muestra el estado de cada idea.
- **Redespliegue:** cambia `VotacionAnonima`, así que las propuestas
  actuales se archivan ([AGENTS.md](../../AGENTS.md#reglas-de-trabajo)).

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
- **Despliegue:** el script falla si la dirección del registro no coincide
  con la que se fijó en `VotacionAnonima`.
- **Web** (`node --test` y E2E):
  - `lib/cid.mjs` acepta el CID correcto y rechaza bytes alterados.
  - `/votar/<id>` no ofrece votar si el contenido no se verifica.
  - El listado sale de los eventos.
  - Axe sin infracciones en `/propuestas/nueva` y `/consejo`, a 375 y
    1280 px.
- **Operación:** el Safe de la demo está desplegado y anotado en
  [despliegue-produccion.md](../despliegue-produccion.md). El pinning
  externo está configurado con una credencial solo de escritura en las
  variables del servicio. Se ha probado que, tras borrar `civora-db`, la web
  reconstruye las propuestas desde la cadena y el pinning.
- **Documentación:** M-04 cerrado en la auditoría, y tabla de garantías y
  modelo de amenazas actualizados.

## Decisiones pendientes del responsable

1. Quién firma en el Safe de la demo y con qué umbral: 2 de 3 con
   personas distintas, o 1 de 1 declarado.
2. Importe del depósito y de `base` en producción, y tope diario de ideas
   retransmitidas en la demo.
3. Proveedor de pinning externo.
4. Espera para cambiar el Safe: 7 días u otro valor.
