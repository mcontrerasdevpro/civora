# CÍVORA

Infraestructura de votación verificable — prueba de concepto para explorar
verificación de elegibilidad y voto digital. Las garantías dependen de la
vía de identificación: hoy no ofrece anonimato integral, censo verificable
ni acreditación de todos los requisitos legales.

## Documentación

| Para | Ver |
|---|---|
| Comandos, convenciones y reglas para agentes de IA | [AGENTS.md](AGENTS.md) |
| Fases, tareas y estado | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Desplegar el contrato y fusionar a `main` | [docs/despliegue-produccion.md](docs/despliegue-produccion.md) |
| Desplegar la web en el VPS (Easypanel, Docker) | [docs/despliegue-vps.md](docs/despliegue-vps.md) |
| Decisiones de arquitectura y su porqué | [docs/decisiones/](docs/decisiones/README.md) |
| Amenazas y limitaciones | [docs/modelo-amenazas.md](docs/modelo-amenazas.md) |
| Auditoría de seguridad | [docs/auditoria-seguridad.md](docs/auditoria-seguridad.md) |
| Especificación funcional | [docs/especificacion-publica.md](docs/especificacion-publica.md) |
| Reportar una vulnerabilidad | [SECURITY.md](SECURITY.md) |

Este README cubre qué es Civora, qué garantiza hoy y cómo configurar el
entorno. Los comandos están solo en [AGENTS.md](AGENTS.md#comandos).

## La idea en una frase

La vía ZKPassport puede acreditar edad mínima y nacionalidad española sin
revelar esos atributos al contrato. La vía de certificado verifica una
firma en el servidor y puede vincular certificado y opción. Consulta la
tabla de garantías antes de interpretar los resultados de esta PoC.

## Requisitos objetivo

- Tener la nacionalidad española.
- Estar empadronado en cualquier municipio de España.
- Ser mayor de 18 años.
- Tener un documento español: DNI o pasaporte.
- Residencia continuada en España de al menos 5 años (se mantiene en la
  demo de pruebas).

Las cuatro primeras son obligatorias y deben contrastarse con la DGP y el
INE: si alguna no se cumple o no puede comprobarse, el voto no se emite
([ADR 0015](docs/decisiones/0015-condiciones-voto-organismos-publicos.md)).
Esas conexiones requieren una administración pública convocante y están
pendientes de aprobación, así que hoy no todos los requisitos se verifican.

## Estado de la demo pública

`https://civora.nexuraia.com` es una demo de pruebas en Sepolia, con el
banner **MODO DEMOSTRACIÓN**:

- **Certificado digital (Autofirma):** funciona con certificados reales
  (probado en Edge y Brave). La edad se declara y no se contrasta.
- **DNIe o pasaporte (ZKPassport):** solo funciona con los **pasaportes
  simulados** de la app ZKPassport. El registro de certificados de
  ZKPassport en Sepolia solo contiene los de esos documentos; los reales
  solo se verifican en una red principal (Base o Ethereum), pendiente de la
  aprobación de los organismos. Contrato de demostración:
  `0xe5B87219E2dda01c61f8491Cc6AcEd5dD85C1Ed6`
  ([despliegue-produccion.md](docs/despliegue-produccion.md#contrato-desplegado)).
- Las propuestas creadas con contratos anteriores se archivan solas: no se
  listan ni admiten votos.
- Al pulsar «Escuchar» se avisa, por escrito y por voz, de que otras
  personas podrían oír el voto, y no se lee nada hasta confirmar que se
  llevan auriculares.

## Garantías por requisito

| Requisito | Estado | Qué se garantiza hoy |
|---|---|---|
| Edad mínima (18 años) | Parcial | ZKPassport genera una prueba comprobada on-chain. En la vía de certificado la edad se declara en el navegador y no se contrasta con una fuente oficial (requiere la DGP, [ADR 0015](docs/decisiones/0015-condiciones-voto-organismos-publicos.md)). |
| Nacionalidad española | Parcial | La prueba ZK exige `ESP` on-chain; el contrato de demostración no la exige, porque los pasaportes simulados no son españoles. La vía de certificado solo acepta certificados con DNI, que solo se expide a españoles. |
| Documento español (DNI o pasaporte) | Parcial | Certificado: NIF de DNI con cadena hasta FNMT o DGP. ZKPassport: DNI o pasaporte leído del chip; en la demo, solo pasaportes simulados. |
| Empadronamiento en España | Pendiente | Ninguna vía consulta el padrón ni una atestación equivalente. Conexiones necesarias con DGP e INE: [ADR 0015](docs/decisiones/0015-condiciones-voto-organismos-publicos.md). |
| Residencia continuada de 5 años | Pendiente | Ninguna vía acredita duración de residencia. |
| Voto único por persona | Parcial | El contrato impide repetir el mismo nullifier en una propuesta. No hay un identificador común verificable entre certificado y ZK ni un censo que impida voto cruzado. |
| Integridad de la opción | Hecho | La prueba de identidad incluye la opción y no sirve para otra: el certificado firma un reto con la opción (R-04) y la prueba ZKPassport lleva la opción vinculada, comprobada en el contrato (R-01, [ADR 0014](docs/decisiones/0014-opcion-vinculada-prueba-zk.md)). |
| Anonimato por vía | Parcial | **ZKPassport:** el contrato no recibe el documento, pero publica nullifier y opción; el servidor ve la petición. **Certificado:** el servidor verifica el certificado y recibe la opción en el mismo flujo, por lo que puede vincular identidad y voto. |
| Canales y voto asistido | Pendiente (Fase 1) | Solo existe el canal digital autónomo. Diseño acordado: tres canales (digital, punto asistido presencial y papel) y un único canal por persona, asignado al registrarse antes de congelar el censo. |
| Coacción en el voto remoto | Pendiente | Ninguna mitigación técnica hoy. Previstas: asignación de canal (Fase 1) y prevalencia del voto presencial sobre el digital (Fase 2, MACI). |
| Teléfono de ayuda | Pendiente | No existe. Requisito: nunca pregunta ni registra el sentido del voto. |
| Asistente de IA | No implementado | Futuro. Ayudaría con el proceso, nunca con la decisión, y no tocaría la papeleta. |

Esta PoC no debe usarse para elecciones oficiales ni vinculantes. La
publicación de recuentos por la aplicación se retrasa hasta el cierre, pero
los votos individuales y sus recuentos siguen siendo observables en la
cadena pública.

La red de producción está pendiente de decidir
([ROADMAP](docs/ROADMAP.md#paso-a-producción)). El diseño del voto asistido
está en el [modelo de amenazas](docs/modelo-amenazas.md#inclusión-y-voto-asistido)
y los límites del asistente de IA, en el
[ADR 0009](docs/decisiones/0009-limites-asistente-ia.md).

## Qué hay montado ahora mismo

| Componente | Ubicación | Estado |
|---|---|---|
| Landing / web | apps/web | /propuestas lista y crea propuestas, /votar/[id], /resultados/[id] y /verificar funcionan de extremo a extremo, en local contra un nodo Hardhat y en la demo contra Sepolia |
| Tipos compartidos | packages/shared-types | Esquema de propuesta, voto y resultados (Zod) |
| Identidad | packages/zk-identity + apps/web/lib | /votar ofrece DNIe/pasaporte por NFC (ZKPassport, prueba verificada en el contrato) y certificado digital (Autofirma + FNMT/DNIe, firma verificada en el servidor); la vía de certificado no es anónima frente al servidor |
| Contratos | packages/contracts | VotacionAnonima.sol - propuestas con apertura/cierre, relayer inmutable para crear propuestas y emitir votos de certificado, nullifier por propuesta y prueba ZKPassport verificada contra el RootVerifier oficial |
| Base de datos | Postgres (en el VPS en la demo, [ADR 0013](docs/decisiones/0013-postgres-en-el-vps.md); cualquier Postgres en local) | Guarda el contenido de cada propuesta (título, pregunta, fechas); el contrato ancla el hash de ese contenido para integridad |
| Documentación | docs/ | Ver [Documentación](#documentación) |

## Arrancar en local o Codespaces

Este repo está preparado para abrirse directamente en GitHub Codespaces
(.devcontainer ya configurado) o en local con pnpm. Los comandos de
instalación, nodo local, despliegue y arranque están en
[AGENTS.md](AGENTS.md#comandos).

El contrato necesita un nodo Ethereum local corriendo antes de arrancar la
web. El script de despliegue escribe la dirección + ABI en
apps/web/lib/generated/despliegue-localhost.json (se regenera en cada
despliegue, no se versiona). Las propuestas ya no se crean aquí: se crean
desde la web en /propuestas/nueva, lo que requiere una base de datos (ver
siguiente sección).

## Base de datos

El contenido de cada propuesta (título, pregunta, fechas de apertura y
cierre) se guarda en Postgres; el contrato solo ancla el hash de ese
contenido para poder verificar su integridad.

En la demo pública, Postgres corre en el propio VPS como servicio
`civora-db`, sin puerto externo
([despliegue-vps.md](docs/despliegue-vps.md#base-de-datos-civora-db),
[ADR 0013](docs/decisiones/0013-postgres-en-el-vps.md)).

En local vale cualquier Postgres. Por ejemplo, con Docker:

    docker run -d --name civora-db -e POSTGRES_PASSWORD=<contraseña> -e POSTGRES_DB=civora -p 5432:5432 postgres:16

Y en `apps/web/.env.local` (no se versiona):

    DATABASE_URL=postgresql://postgres:<contraseña>@localhost:5432/civora?sslmode=disable

`?sslmode=disable` es necesario si tu Postgres no tiene TLS, como el del
ejemplo; con un Postgres remoto usa `?sslmode=require`.

La tabla `propuestas` se crea sola la primera vez que la web la necesita
(no hace falta ejecutar ninguna migración a mano).

Con el nodo de Hardhat, el contrato desplegado y `DATABASE_URL` definida,
ya se puede arrancar la web ([AGENTS.md](AGENTS.md#comandos)). La web queda disponible en http://localhost:3000. Crea tu primera propuesta
en http://localhost:3000/propuestas/nueva. Si reinicias el nodo de
Hardhat, vuelve a ejecutar `deploy:localhost` (la dirección del contrato
cambia con cada nodo nuevo; las propuestas guardadas en la base de datos
quedan huérfanas hasta que las recrees).

## Desplegar en Sepolia + VPS

La demo pública se sirve en `https://civora.nexuraia.com` desde un VPS con
Easypanel, con la imagen del [`Dockerfile`](Dockerfile)
([ADR 0011](docs/decisiones/0011-alojamiento-vps-propio.md)); el contrato no
puede vivir en un nodo Hardhat local y se despliega en la testnet Sepolia.
El contrato, las variables (obligatorias, build arg o ejecución, cambios) y
las comprobaciones antes de fusionar están en
[docs/despliegue-produccion.md](docs/despliegue-produccion.md); DNS,
Easypanel y la imagen, en [docs/despliegue-vps.md](docs/despliegue-vps.md).
Sin CONTRATO_DIRECCION, apps/web/lib/contrato.ts asume que estás en local y
busca el despliegue de Hardhat.

## Identidad con ZKPassport (verificación on-chain)

La vía de DNIe/pasaporte genera una prueba en modo `compressed-evm` y la
envía, sin verificarla en ningún servidor, a
`VotacionAnonima.votarConPruebaZk`: el contrato la verifica él mismo,
llamando al **RootVerifier oficial de ZKPassport**
(`0x1D000001000EFD9a6371f4d90bB8920D5431c0D8`, mismo address en Ethereum,
Sepolia y Base) y comprobando edad mínima, nacionalidad y que la prueba se
generó para esa propuesta concreta (ver `packages/contracts/contracts/`).
Ni este servidor ni su operador pueden aceptar un voto por esta vía sin una
prueba criptográfica válida ([ADR 0003](docs/decisiones/0003-zkpassport-verificacion-on-chain.md)).

La prueba se genera al confirmar el voto y lleva la opción vinculada
(`custom_data = civora-voto:<propuesta>:<opción>`): el contrato rechaza
cualquier otra opción ([ADR 0014](docs/decisiones/0014-opcion-vinculada-prueba-zk.md)).
La web toma la prueba en cuanto llega del móvil (`onProofGenerated`) y la
envía al contrato sin esperar a que el SDK la verifique en el navegador: esa
verificación enviaría la prueba, con la IP del votante, a un nodo de Alchemy,
y la CSP la bloquea a propósito. El SDK se crea con `disableProofStorage`
para que no suba las pruebas al panel de ZKPassport. En redes locales de Hardhat se despliega en su
lugar un `MockRootVerifier` (ver `packages/contracts/test/`), porque el
verificador real solo existe en redes públicas.

`DEV_MODE` está desactivado por defecto tanto en la web como en el contrato.
En local, actívalo explícitamente solo para una demo con pruebas mock. Las
variables deben coincidir entre web y despliegue, o el contrato rechazará
las pruebas:

    # apps/web/.env.local
    NEXT_PUBLIC_ZKPASSPORT_DOMAIN=tu-dominio.com   # dominio propio, registrado en zkpassport.id
    NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false          # false para exigir pruebas reales (NFC), no mock

    # packages/contracts/.env
    ZKPASSPORT_DOMAIN=tu-dominio.com
    ZKPASSPORT_DEV_MODE=false
    RELAYER_ADDRESS=<dirección que corresponde a HARDHAT_RELAYER_PRIVATE_KEY>

En redes no locales el despliegue falla si no defines un dominio propio,
`ZKPASSPORT_DEV_MODE=false` explícito y `RELAYER_ADDRESS`. La web aplica la
misma validación en producción. Única excepción: la demo pública en
Sepolia con `CIVORA_DEMO_TESTNET=true`
([ADR 0010](docs/decisiones/0010-demo-publica-testnet.md)); pasos y
variables en [docs/despliegue-produccion.md](docs/despliegue-produccion.md). `devModeZk` y el relayer son inmutables:
para cambiarlos hay que desplegar otro contrato. Para demo local, define
`NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=true` en la web y
`ZKPASSPORT_DEV_MODE=true` al desplegar; se mostrará el banner
**MODO DEMOSTRACIÓN**.

## Identidad con certificado digital (Autofirma)

La vía de certificado digital usa [Autofirma](https://github.com/ctt-gob-es/clienteafirma),
la herramienta oficial del Gobierno de España (hay que tenerla instalada):
el navegador le pide que firme un código aleatorio con el certificado
instalado (FNMT, DNIe...) y el servidor comprueba, en
`apps/web/lib/certificado-digital.ts`:

1. Que la firma CMS/CAdES es criptográficamente válida y cubre exactamente
   ese código.
2. Que el certificado encadena hasta una autoridad real (la FNMT-RCM o la
   Dirección General de la Policía). Las raíces de confianza están en
   `apps/web/lib/certificados-raiz/` (descargadas de sus webs oficiales).
3. Que el certificado no está revocado, consultando por OCSP al
   respondedor que el propio certificado declara.

A diferencia de ZKPassport, aquí no hay verificador on-chain: la
verificación ocurre en este servidor. Si el certificado no declara un NIF,
se rechaza; no se usa el emisor y número de serie como respaldo. El voto se
envía con `votarManual`, función que solo acepta transacciones del relayer
inmutable. La opción llega al mismo servidor que verifica la identidad, por
lo que esta vía no es anónima frente al operador. Tampoco se comprueba
criptográficamente la edad (un certificado no lleva la fecha de nacimiento).

Variables de entorno (`apps/web/.env.local`):

    RETO_CERTIFICADO_SECRET=<una cadena aleatoria larga>
    FALLO_ABIERTO_REVOCACION=false   # true para aceptar el voto si OCSP no responde (no si SI consta revocado)

## Crear propuestas

En la demo, `POST /api/propuestas` no pide clave: cualquiera puede crear
propuestas, con un límite por IP. El contrato restringe la creación al
relayer inmutable, que paga el gas. Es un riesgo aceptado solo para la demo
([auditoría, M-04](docs/auditoria-seguridad.md#m-04--medio--creación-de-propuestas-sin-autorización-riesgo-aceptado-en-la-demo)).

## Estructura

    civora/
      apps/web         -> Next.js: landing, propuestas, voto, resultados, verificador
      packages/contracts    -> Contrato de votación (Solidity)
      packages/zk-identity   -> Capa de identidad ZK (agnóstica de proveedor)
      packages/shared-types  -> Esquema compartido de propuesta/voto/resultados
      docs/            -> ROADMAP, decisiones (ADR), modelo de amenazas, auditoría y especificación

## Por qué estas decisiones

Cada decisión, con su contexto y alternativas, está en
[docs/decisiones/](docs/decisiones/README.md).

## Aviso legal

Esta es una prueba de concepto técnica, no un sistema habilitado para
elecciones oficiales vinculantes en España.
