# Hoja de ruta

Estado de cada fase y sus tareas. Las amenazas y los riesgos abiertos están
en el [modelo de amenazas](modelo-amenazas.md) y en la
[auditoría](auditoria-seguridad.md); las decisiones, en
[decisiones/](decisiones/README.md). Al cerrar una tarea, sigue el
[procedimiento de cierre](../AGENTS.md#cierre-de-tarea).

Estados: **hecho**, **en curso**, **pendiente**.

| Fase | Estado | Rama |
|---|---|---|
| [Fase 0: seguridad](#fase-0-seguridad) | hecho | `fase-0-seguridad` |
| [Accesibilidad y voto asistido (web)](#accesibilidad-y-voto-asistido-web) | hecho, con pendientes | `accesibilidad-voto-asistido` |
| [Revisión externa R-01 a R-05](#revisión-externa-r-01-a-r-05) | hecho, salvo R-01 | `correcciones-revision` |
| [Spike ZKPassport](#spike-zkpassport-deduplicación-entre-vías) | pendiente (siguiente; primero R-01) | — |
| [Servicios, propuestas y red principal](#servicios-propuestas-y-red-principal) | diseño aceptado, sin implementar ([ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md), [ADR 0017](decisiones/0017-servicios-por-frontera-de-confianza.md)) | `adr-arquitectura-servicios` (solo diseño) |
| [Fase 1: Semaphore](#fase-1-semaphore) | pendiente | — |
| [«Intenta hacer trampa» y script de auditoría](#intenta-hacer-trampa-y-script-de-auditoría) | pendiente | — |
| [Idiomas](#idiomas) | pendiente | — |
| [Asistente de IA](#asistente-de-ia) | pendiente (futuro) | — |
| [Paso a producción](#paso-a-producción) | en curso | `despliegue-vps` |
| [Fase 2: MACI y auditoría externa](#fase-2-maci-y-auditoría-externa) | pendiente | — |

## Fase 0: seguridad

**Objetivo:** cerrar los hallazgos críticos de la
[auditoría](auditoria-seguridad.md) sin cambiar la arquitectura de
identidad.

| Tarea | Estado |
|---|---|
| Reinstalar dependencias con lockfile congelado; Hardhat ejecuta sus tests | hecho |
| `DEV_MODE` opt-in; producción exige dominio ZK propio y `false` explícito; banner **MODO DEMOSTRACIÓN** | hecho |
| Retirar el voto manual de UI y API ([ADR 0006](decisiones/0006-eliminacion-via-manual.md)) | hecho |
| Restringir `votarManual` y `crearPropuesta` al relayer inmutable ([ADR 0004](decisiones/0004-relayer-inmutable.md)) | hecho |
| Rechazar certificados sin NIF; prohibir fallo abierto OCSP en producción no local | hecho |
| `POST /api/propuestas` con `ADMIN_SECRET`, comparación en tiempo constante y rate limit por IP | hecho |
| Ocultar resultados y recibos hasta el cierre; fuentes locales; CSP con nonce ([ADR 0007](decisiones/0007-csp-con-nonce.md)) | hecho |

**Criterios de aceptación (cumplidos):** tests de contratos y web en verde;
hallazgos C-01, C-02 y M-04 mitigados según la tabla de la auditoría.

## Accesibilidad y voto asistido (web)

**Objetivo:** que cualquier persona pueda votar sola en el canal digital, y
dejar diseñado el voto asistido para la Fase 1. Diseño y amenazas:
[modelo de amenazas](modelo-amenazas.md#inclusión-y-voto-asistido).

| Tarea | Estado |
|---|---|
| Modo sencillo en `/votar`, recordado en `localStorage` | hecho |
| Confirmación «Va a votar: X. ¿Es correcto?» con Sí / Volver | hecho |
| Avisos fijos: secreto del voto y cómo pedir ayuda | hecho |
| Botón «Escuchar» solo con voces locales; audios propios para la confirmación ([ADR 0008](decisiones/0008-audios-propios-confirmacion.md)) | hecho |
| Aviso de escuchas ajenas al pulsar «Escuchar», por escrito y por voz, y confirmación de auriculares antes de leer | hecho (rama `feat/aviso-escuchar`) |
| WCAG 2.1 AA en el flujo de voto, comprobado con axe en `test:e2e` | hecho |
| Reintento sin perder progreso si caduca el reto de certificado | hecho |
| CSP de desarrollo para que `pnpm dev` funcione ([ADR 0007](decisiones/0007-csp-con-nonce.md)) | hecho |
| Sustituir los audios provisionales por grabaciones profesionales | pendiente |
| Teléfono de ayuda real (nunca pregunta ni registra el sentido del voto) | pendiente |

**Criterios de aceptación (cumplidos):** `test:e2e` sin infracciones axe en
cada paso, modo normal y sencillo, a 1280 y 375 px; la opción elegida no
pasa por `speechSynthesis`.

**Criterios de los pendientes:** audios de locución profesional, uno por
opción del enum, servidos desde `public/audio/confirmacion`; número de
ayuda publicado en los avisos con un protocolo escrito que prohíba preguntar
o registrar el voto.

## Revisión externa R-01 a R-05

**Objetivo:** corregir los hallazgos de la revisión externa. Detalle en la
[auditoría](auditoria-seguridad.md#revisión-externa-2026-10-06-rama-correcciones-revision).

| Tarea | Estado |
|---|---|
| R-02: nullifier de certificado con HMAC y `NULLIFIER_CERTIFICADO_SECRET`; nota on-chain sin nullifier | hecho |
| R-03: DNI del certificado normalizado y validado | hecho |
| R-04: opción incluida en el reto firmado; firma en la confirmación con aviso de Autofirma | hecho |
| R-05: constructor sin dirección cero; NatSpec actualizado | hecho |
| `SECURITY.md` y CI en GitHub Actions | hecho |
| R-01: atar la opción a la prueba ZK | hecho en código ([ADR 0014](decisiones/0014-opcion-vinculada-prueba-zk.md)); pendiente de desplegar el contrato |

## Spike ZKPassport: deduplicación entre vías

**Objetivo:** primero, cerrar R-01 atando la opción a la prueba ZK; después,
decidir cómo impedir que una persona vote por certificado y por ZKPassport a
la vez sin publicar el NIF ni hashes directos del documento
([ADR 0005](decisiones/0005-no-publicar-nif.md)).

| Tarea | Estado |
|---|---|
| **Prioridad 1 (R-01, crítico):** atar la opción a la prueba ZKPassport (datos vinculados al ámbito o a la prueba) y verificarla en el contrato; test que reenvía la prueba con otra opción y es rechazada | hecho en código (rama `feat/r01-opcion-en-prueba-zk`), contrato en Sepolia; primera prueba real: la CSP bloqueaba la verificación local del SDK, corregido tomando la prueba en `onProofGenerated`; pendiente: repetir la prueba con DNIe o pasaporte real |
| Inventariar qué identificadores verificables ofrece ZKPassport (nullifiers con ámbito, atributos revelables) | pendiente |
| Comprobar si alguno puede compartirse con la credencial de certificado sin filtrar el NIF | pendiente |
| Casos de prueba que reproduzcan el voto cruzado actual (hallazgo A-04) | pendiente |
| ADR con la decisión y sus límites | pendiente |

**Dependencias:** ninguna. No despliega cambios de identidad: el resultado
alimenta la Fase 1.

**Criterios de aceptación:** R-01 cerrado: el contrato rechaza una prueba
reenviada con otra opción (test). ADR nuevo aceptado; tests que demuestran el
voto cruzado hoy y documentan qué mecanismo lo impediría; ningún
identificador derivado directamente del NIF o del número de documento en
la propuesta.

## Servicios, propuestas y red principal

**Objetivo:**

- Cerrar M-04 con un proceso de aprobación público.
- Sacar el contenido de las propuestas de una única base de datos.
- Separar las claves por frontera de confianza.
- Preparar el censo y la producción.

Diseño en el [ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md),
el [ADR 0017](decisiones/0017-servicios-por-frontera-de-confianza.md) y el
[ADR 0018](decisiones/0018-licencia-agpl.md) (licencia), con las decisiones
del responsable del 2026-10-07. Usa como referencia los repositorios de
[spain-in-parallel](https://github.com/spain-in-parallel), sin copiar su
código: así se mantiene abierta la vía de licencias comerciales
([ADR 0018](decisiones/0018-licencia-agpl.md#consecuencias)).

**Entornos.** `civora.nexuraia.com` y el VPS compartido son el **entorno de
pruebas actual**. La **producción irá en un VPS dedicado** solo a Civora,
con dominio propio. Las tareas a-c se hacen y se prueban en el entorno de
pruebas. La e es el paso a producción. Los dominios se leen siempre de la
configuración.

Las tareas van en este orden:

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| a | Extraer el relayer a `apps/relayer`: lista blanca de destino y selector, `estimateGas`, tope de gas, tope de gasto de 10 € al día con 8 € reservados para votos y alerta al empezar a consumir la reserva, autenticación por cliente y sin dominio público en ningún entorno ([ADR 0017](decisiones/0017-servicios-por-frontera-de-confianza.md)) | — | pendiente |
| b | `RegistroIdeas` + Safe + IPFS: propuestas aprobadas por multifirma (Safe 1 de 1 declarado en pruebas), depósito de 5 € (2 € no reembolsables), 20 ideas al día sin cartera, espera de 7 días para cambiar el Safe, votaciones de 1 hora a 90 días (inmutables por despliegue), CID verificado en la web contra cada fuente, pinning en Pinata y Filebase, y nueva versión de `VotacionAnonima` que solo acepta el registro ([ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md)) | a; redespliegue del contrato en Sepolia | pendiente |
| c | Extraer el servicio de identidad a `apps/identidad`, en su propio subdominio (`identidad.<dominio>`, por configuración): certificados, OCSP, `NULLIFIER_CERTIFICADO_SECRET` y `RETO_CERTIFICADO_SECRET` fuera de la web; cupo de propuestas por persona ([ADR 0017](decisiones/0017-servicios-por-frontera-de-confianza.md)) | a | pendiente |
| d | Diseño del censo de la [Fase 1](#fase-1-semaphore) usando como referencia el registro y voto de Rarimo/spain-in-parallel | b, c; spike ZKPassport | pendiente |
| e | **Producción, en un solo paso:** VPS dedicado solo a Civora, dominio definitivo, red principal Base y redespliegue de los contratos con ese dominio, para probar documentos reales con ZKPassport | a, b, c; verificación pública del bytecode; dominio definitivo registrado | pendiente: requiere la aprobación de los organismos ([ADR 0015](decisiones/0015-condiciones-voto-organismos-publicos.md)) |

**Criterios de aceptación:**

- **a.**
  - El relayer rechaza destinos y selectores fuera de la lista, clientes sin
    firma válida y llamadas que revierten en `estimateGas`, y respeta los
    topes de gas y de gasto.
  - Un test compara los selectores permitidos con el ABI compilado.
  - `HARDHAT_RELAYER_PRIVATE_KEY` no está en `apps/web` ni en su imagen.
  - `civora-relayer` no responde desde fuera del VPS.
  - Al agotar el subtope de ideas y aprobaciones (2 €) sigue aceptando
    votos; avisa en cuanto un voto empieza a consumir la reserva de 8 € y
    solo rechaza votos al agotar los 10 € (tests). Los topes se cambian con
    variables de entorno, sin reconstruir la imagen.
  - `test:e2e` en verde; voto ZK y de certificado comprobados en la demo.
- **b.** Los del [ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md#criterios-de-aceptación):
  - solo el registro crea propuestas, y solo tras aprobarlas el Safe;
  - pagos *pull* con invariante de solvencia;
  - destino inmutable;
  - espera de 7 días para cambiar el Safe, con evento y cancelación;
  - duración de 1 hora a 90 días, inmutable por despliegue (en producción,
    probablemente un mínimo de 24 horas);
  - test que demuestra que nada del registro ni del Safe altera una
    propuesta ya creada ni sus votos;
  - Safe 1 de 1 declarado en el README y en `/consejo`;
  - cada fuente (pasarelas y `civora-db`) verificada contra el CID; el
    contenido que no coincide no se muestra nunca, y si ninguna fuente
    responde con contenido válido, la web avisa, muestra el CID y deja votar;
  - una propuesta aprobada solo deja de fijarse por decisión pública del
    Safe (`ContenidoRetirado`) o por orden judicial, y la votación sigue;
  - Pinata y Filebase devuelven el mismo CID que calcula Civora;
  - 20 ideas al día sin cartera;
  - la web se reconstruye tras borrar `civora-db`;
  - M-04 cerrado en la auditoría.
- **c.**
  - Los dos secretos de identidad solo existen en `apps/identidad`
    (test y job de imágenes).
  - Solo `identidad` puede pedir `votarManual` al relayer.
  - La web no recibe el certificado.
  - Voto con certificado real comprobado en Edge y Brave tras desplegar.
  - El origen de identidad y el de la web salen de la configuración; el CORS
    solo admite el origen de la web y la CSP solo añade el de identidad.
  - Memoria medida con `docker stats` y límites fijados en Easypanel.
- **d.** Lo que debe cubrir el ADR del censo:
  - **Comparación con Semaphore** del registro y voto de Rarimo:
    - `RegistrationSimple` y `StateKeeper`;
    - árbol de identidades `PoseidonSMT`;
    - un `ProposalSMT` por propuesta contra el doble voto;
    - reglas por propuesta en `ProposalsState`: nacionalidad, edad y
      caducidad.

    Fuentes: `deployed-contracts/deploy/architecture.txt` y
    `council-dao/idea-v1.md`.
  - **Riesgos que no se pueden heredar:**
    - En el piloto de spain-in-parallel, `StateKeeper` está desplegado como
      *mock*, con setters sin control y `_authorizeUpgrade` vacío
      (`deployed-contracts/01-StateKeeperMock/README.md`).
    - Sus contratos son UUPS (actualizables), lo que choca con la
      inmutabilidad de los ADR 0004 y 0010.
    - Su *registrator* verifica la cadena CSCA con `node-forge` y está
      pendiente de auditoría (`gateway/registrator/passive-auth.mjs:19-28`).
  - Los criterios de la Fase 1 siguen vigentes.
- **e.** Por qué va todo junto: el dominio de ZKPassport (`dominioZk`) se
  fija en el contrato al desplegarlo. Cambiar de dominio obliga a
  redesplegar, y redesplegar en Base sin el VPS dedicado dejaría la
  producción en un servidor compartido. Se hace una sola vez, en este
  orden:
  1. VPS dedicado endurecido.
  2. Dominio definitivo registrado en ZKPassport.
  3. Servicios desplegados con ese dominio por configuración.
  4. Contratos desplegados en Base con `dominioZk` = dominio definitivo.
  5. Verificación byte a byte.
  6. Prueba con documento real.

  Criterios:
  - Contratos desplegados en Base y comprobados byte a byte (ver
    [Verificación pública del bytecode](#verificación-pública-del-bytecode)).
  - Ningún dominio fijo en el código ni en las imágenes; el de pruebas y el
    de producción solo se distinguen por variables de entorno.
  - Kubo propio como tercera copia de IPFS; Postgres con copias de seguridad
    probadas y TLS o red aislada.
  - `CIVORA_DEMO_TESTNET` retirada.
  - Un voto con un DNIe o pasaporte real aceptado por el contrato, con
    `devModeZk=false` y nacionalidad `ESP` exigida.
  - Tope de gasto del relayer activo.
  - Creación de propuestas solo por `RegistroIdeas`.

## Fase 1: Semaphore

**Objetivo:** voto anónimo por pertenencia a un censo congelado, con un
único mecanismo de deduplicación para todas las vías (hallazgos A-01, A-03 y
A-04).

| Tarea | Estado |
|---|---|
| Diseño del censo con el registro y voto de Rarimo/spain-in-parallel como referencia, comparado con Semaphore (tarea [d](#servicios-propuestas-y-red-principal)) | pendiente |
| Definir la autoridad y el proceso de formación del censo (padrón e INE requieren convenio oficial) | pendiente |
| Conexiones obligatorias con organismos públicos ([ADR 0015](decisiones/0015-condiciones-voto-organismos-publicos.md#conexiones-obligatorias-con-organismos-públicos)): DGP (SVDI: DNI, nacionalidad y fecha de nacimiento), pasaporte español (a confirmar con la DGP), INE (residencia con fecha de última variación padronal e histórico), padrón municipal si convoca un ayuntamiento | pendiente: requiere administración convocante y alta en la PID |
| Rechazar el registro si la fecha de nacimiento declarada no coincide con la de la DGP o si falta cualquiera de las cuatro condiciones | pendiente |
| Registro de elegibles: alta de un compromiso de identidad Semaphore tras acreditar elegibilidad | pendiente |
| Asignación de canal (digital, punto asistido o papel) al registrarse, antes de congelar | pendiente |
| Grupo y raíz Merkle congelados y publicados antes de abrir la votación | pendiente |
| Votación con prueba Semaphore de pertenencia y nullifier por propuesta | pendiente |
| Punto de voto asistido: lector NFC del punto, modo quiosco, identidad generada y destruida en la sesión, registro de «voto asistido» sin contenido | pendiente |
| Revisar la caducidad de 5 minutos del reto de certificado para el voto asistido | pendiente |
| Pruebas de integración de extremo a extremo antes de retirar la vía de certificado | pendiente |
| Eliminar `votarManual` del contrato | pendiente |

**Dependencias:** spike ZKPassport; redespliegue del contrato
([Paso a producción](#paso-a-producción)).

**Criterios de aceptación:**
- El contrato rechaza votos de quien no pertenece a la raíz congelada y un
  segundo voto con el mismo nullifier, sea cual sea la vía de registro.
- Ningún servicio recibe a la vez identidad y opción.
- La raíz no puede cambiar después de la apertura (test de contrato).
- Cada persona tiene un solo canal; el canal digital rechaza a quien está
  asignado a otro (test).
- `votarManual` ya no existe y todos los tests pasan.

## «Intenta hacer trampa» y script de auditoría

**Objetivo:** que cualquiera pueda comprobar las garantías sin confiar en el
operador.

| Tarea | Estado |
|---|---|
| Página «Intenta hacer trampa» con ataques guiados (doble voto, voto fuera de plazo, prueba falsa) y el resultado esperado | pendiente |
| Script de auditoría reproducible que recalcula el recuento desde la cadena y lo compara con la aplicación | pendiente |

**Dependencias:** Fase 1, para que los ataques muestren el modelo final.

**Criterios de aceptación:** cada ataque de la página falla con el motivo
explicado; el script se ejecuta con un único comando sobre una red pública y
obtiene el mismo recuento que la aplicación.

## Idiomas

**Objetivo:** el flujo de voto en las lenguas cooficiales y en inglés.

| Tarea | Estado |
|---|---|
| Extraer los textos de la interfaz, incluidos los del modo sencillo | pendiente |
| Traducciones (catalán/valenciano, euskera, gallego e inglés) revisadas por personas | pendiente |
| Audios de confirmación por idioma | pendiente |

**Dependencias:** grabaciones profesionales de los audios.

**Criterios de aceptación:** `test:e2e` y axe en verde en cada idioma; ningún
texto del flujo sin traducir; atributo `lang` correcto en cada página.

## Asistente de IA

**Objetivo:** ayudar con el proceso, nunca con la decisión. Límites
obligatorios en [ADR 0009](decisiones/0009-limites-asistente-ia.md); amenazas
en el [modelo de amenazas](modelo-amenazas.md#asistente-de-ia-futuro-no-implementado).
**No implementar todavía.**

| Tarea | Estado |
|---|---|
| Diseño del servicio aislado y de su desconexión anunciada en el paso de votar | pendiente |
| Evaluación del Reglamento europeo de IA | pendiente |
| Contenido de propuestas firmado y resúmenes neutrales aprobados de antemano | pendiente |

**Dependencias:** Fase 1 e idiomas.

**Criterios de aceptación:** el asistente no tiene herramientas ni acceso a
identidad, contrato o relayer (revisión de código y test); los registros no
contienen datos de la sesión de voto; prueba de inyección de instrucciones
con contenido manipulado sin efecto.

## Paso a producción

**Objetivo:** que `main` pueda desplegarse con garantías.

| Tarea | Estado |
|---|---|
| Procedimiento de despliegue y PR #5 a `main` ([despliegue-produccion.md](despliegue-produccion.md)) | hecho: PR #5 fusionado en `main` (2026-10-07) |
| Demo pública en Sepolia con opt-in `CIVORA_DEMO_TESTNET` ([ADR 0010](decisiones/0010-demo-publica-testnet.md)) | en uso desde 2026-10-07: en Sepolia solo pasan los pasaportes simulados de ZKPassport; contrato de demostración `0xe5B87219E2dda01c61f8491Cc6AcEd5dD85C1Ed6` (`devMode`, sin exigir nacionalidad) |
| Validar la vía ZK con un DNIe o pasaporte real: requiere red principal (Base o Ethereum), tope de gasto del relayer y autorización para crear propuestas (tarea [e](#servicios-propuestas-y-red-principal)) | pendiente: a la espera de la aprobación de los organismos públicos ([ADR 0015](decisiones/0015-condiciones-voto-organismos-publicos.md)) |
| Script `verificar:sepolia` que compara relayer, dominio y `devMode` del contrato desplegado | hecho |
| Ampliar `verificar:sepolia` a una comparación byte a byte del código desplegado ([propuesta](#verificación-pública-del-bytecode)) | pendiente (diseño propuesto) |
| Licencia AGPL-3.0-or-later: `LICENSE`, campo `license` y cabeceras SPDX ([ADR 0018](decisiones/0018-licencia-agpl.md)); el contrato muestra la nueva cabecera desde su próximo despliegue | hecho (rama `adr-arquitectura-servicios`) |
| Acuerdo de cesión (CLA) revisado por un abogado y `CONTRIBUTING.md`; hasta entonces no se aceptan PR externas ([ADR 0018](decisiones/0018-licencia-agpl.md)) | pendiente |
| Enlace al código fuente del commit desplegado en el pie de la web (AGPL, sección 13) | pendiente |
| Confirmar con ZKPassport, por escrito, la licencia de `@zkpassport/utils`, que no la declara en su `package.json` ([ADR 0018](decisiones/0018-licencia-agpl.md#dependencias)). Bloquea el paso a producción (tarea [e](#servicios-propuestas-y-red-principal)) y la oferta de cualquier licencia comercial | pendiente |
| Imagen Docker reproducible, `/api/salud`, registros sin datos y job «Imagen Docker» en CI ([ADR 0011](decisiones/0011-alojamiento-vps-propio.md)) | hecho; CI en verde en GitHub |
| Un solo servicio `civora` en Easypanel (proyecto `nexuraia`), primero en `actualizar-dependencias` y tras fusionar en `main` ([despliegue-vps.md](despliegue-vps.md#3-un-solo-servicio)) | hecho: *Source* en `main` (2026-10-07); durante la prueba de R-01, en su rama |
| Contrato en Sepolia `0x628901F7bC5Ab55c8b6289a05F0AD543DA94Bdb7` (con R-01; sustituye a `0xDCfe…FC3C`) (dominio `civora.nexuraia.com`, `devMode` desactivado), verificado con `verificar:sepolia`; la demo usa el de demostración | hecho |
| Desactivar los access logs del proxy (o excluir la IP) y rotar los registros de Docker | pendiente |
| Cada propuesta guarda el contrato con el que se creó: las de contratos anteriores no se listan, no admiten votos y avisan con un 410; rechazos del contrato sin mensaje propio, con 400 y selector registrado (rama `feat/propuestas-por-contrato`) | hecho |
| Panel de Easypanel con dominio y HTTPS (hoy en `http://<IP>:3000`) y puerto 3000 cerrado en el firewall del VPS | pendiente |
| *Auto Deploy* con webhook de GitHub creado a mano: el token de Easypanel no puede gestionar webhooks (403); la URL del webhook es secreta | pendiente |
| Creación de propuestas abierta en la demo, sin `ADMIN_SECRET` (M-04 como riesgo aceptado) | hecho |
| Volver a exigir autorización y un tope de gasto del relayer antes de producción real | pendiente: diseño en las tareas [a y b](#servicios-propuestas-y-red-principal) (aprobación por multifirma, [ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md); tope en el servicio `relayer`, [ADR 0017](decisiones/0017-servicios-por-frontera-de-confianza.md)) |
| Demo de pruebas: la vía de certificado mantiene la edad declarada y se mantiene la residencia de 5 años en la elegibilidad, hasta tener las conexiones con DGP e INE ([ADR 0015](decisiones/0015-condiciones-voto-organismos-publicos.md)) | decidido (2026-10-07) |
| Postgres de la demo en el VPS (`civora-db`, sin puerto externo) ([ADR 0013](decisiones/0013-postgres-en-el-vps.md)) | hecho; pendiente de revisar en producción |
| Copias de seguridad automáticas y probadas de la base de datos, antes de producción real | pendiente |
| Retirar Neon del proyecto: la web, la documentación y la vuelta atrás ya solo usan el Postgres del VPS | hecho (2026-10-07); la base sigue creada en Neon, sin uso |
| Retirar Vercel tras completar la migración | en curso: desconectado de GitHub, ya no despliega |
| Para producción real: VPS dedicado solo a Civora, endurecido y supervisado | pendiente: va con la tarea [e](#servicios-propuestas-y-red-principal), junto con Base y el dominio definitivo |
| Entorno de pruebas separado (contrato y dominio propios), con el VPS dedicado | pendiente: al pasar a producción (tarea [e](#servicios-propuestas-y-red-principal)), `civora.nexuraia.com` puede quedar como entorno de pruebas |
| Dependencias: Next 15.5.27 y React 19.2.8, sin `node-forge` en runtime, `pnpm audit --prod` limpio y Dependabot agrupado ([ADR 0012](decisiones/0012-next-15-react-19.md)) | hecho |
| CSP con nonce en todas las páginas (renderizado dinámico), resultados «no disponibles» sin 500, `Referrer-Policy: no-referrer` y E2E de todas las páginas ([auditoría](auditoria-seguridad.md#revisión-en-producción-2026-10-07-rama-actualizar-dependencias)) | hecho; pendiente de revisar en producción |
| CSP que permite abrir Autofirma (`wss`/`https` a `127.0.0.1` y `frame-src afirma:`), E2E sin simulacro de la conexión y favicon ([auditoría](auditoria-seguridad.md#csp-y-autofirma-2026-10-07-rama-fixcsp-autofirma)) | hecho; firmado con Autofirma y certificado real en producción con Edge y Brave (2026-10-07); pendiente de probar en Firefox |
| Revisión completa del PR #5: C-03 (firma atada al certificado validado), aviso de recibo antes del cierre y título de resultados ([auditoría](auditoria-seguridad.md#revisión-del-pr-5-2026-10-07-rama-fixrevision-pr5)) | hecho |
| Revisar los 4 avisos de desarrollo sin parche (`braces`, `node-forge` en tests, `sprintf-js`, `elliptic`) al migrar a Hardhat 3 | pendiente |
| Next 16 como tarea propia (versión mayor) | pendiente |
| `@zkpassport/sdk` 0.18.2 o posterior como tarea propia: compatibilidad con el verificador del contrato y prueba con un documento real (la 0.18.0 se publicó rota, PR #12) | revertido (2026-10-07): con la 0.18.2 desplegada, la app ZKPassport falla al generar la prueba con un pasaporte simulado («Something went wrong»); se vuelve a la 0.16.2, que funciona. Investigar la compatibilidad de la 0.18 con la app antes de reintentarlo |
| TypeScript 7 y `@types/node` acorde al Node de ejecución, como tareas propias (Dependabot ignora sus versiones mayores) | TypeScript 7 bloqueado: su paquete ya no expone la API de JavaScript que usan `next build` y `next typegen`; esperar a que Next lo soporte (con Next 16) |
| **Hardhat 3 (siguiente tarea, 1–2 h):** `packages/contracts` a ESM con `defineConfig`, `@nomicfoundation/hardhat-toolbox-mocha-ethers`, redes `type: "http"`, `network.create()` en tests y `network.connect()` en los scripts (`deploy`, `verificar-despliegue`, `deployment-config` a ESM); comprobar que el bytecode no cambia (salvo metadatos) para no redesplegar, que `node` y `deploy:localhost` siguen generando `apps/web/lib/generated/despliegue-localhost.json` y que desaparecen los 4 avisos de desarrollo. Ojo: el toolbox 4 pide `mocha` 12 | pendiente (2026-10-08) |
| Decidir la red: Base u otra red principal, o red permisionada (ADR) | propuesta: Base, en la tarea [e](#servicios-propuestas-y-red-principal); falta el ADR |
| Retirar `CIVORA_DEMO_TESTNET` al pasar a una red principal | pendiente |
| Protección de `main` en GitHub (checks obligatorios «Tests, typecheck, build y E2E» e «Imagen Docker») | hecho |
| CI con tests de contratos y web, typecheck, build y `test:e2e` (`.github/workflows/ci.yml`) | hecho; en verde en GitHub |
| Rate limit compartido entre instancias (hoy en memoria) | pendiente |
| Dominio ZKPassport propio registrado y `DEV_MODE=false` | pendiente: el dominio definitivo se registra y se fija en el contrato en la tarea [e](#servicios-propuestas-y-red-principal) |
| Probar OCSP contra los respondedores reales de FNMT/DGP y añadir CRL de respaldo | pendiente |

**Dependencias:** ninguna para CI y protección de `main`; la red, antes de
la Fase 1 en producción.

**Criterios de aceptación:** un PR a `main` no puede fusionarse sin CI en
verde; `https://civora.nexuraia.com/api/salud` responde y el servicio de
producción apunta al contrato de la red elegida; los registros del proxy no
contienen IPs de votantes; dos instancias comparten el límite de intentos
(test).

### Verificación pública del bytecode

Propuesta, sin implementar, inspirada en
`spain-in-parallel/deployed-contracts`:

- `verify/verify-bytecode.mjs` compara `eth_getCode` con el
  `deployedBytecode` del artefacto.
- Distingue tres resultados: idéntico, idéntico salvo metadatos, y
  distinto (líneas 100-110).
- Normaliza los enlaces a librerías y el inmutable `__self` de los
  proxies UUPS.

Hoy `verificar:sepolia` solo lee `relayer`, `dominioZk` y `devModeZk`. Eso
no demuestra que el código desplegado sea el del repositorio.

**Qué haría:**

1. **Compilación reproducible:**
   - Fijar en `hardhat.config.js` la versión exacta de `solc`, el
     optimizador y `evmVersion`. Hoy solo se fija `0.8.30`; el resto son
     valores por defecto que pueden cambiar con Hardhat 3.
   - Guardar en `packages/contracts/desplegados/<red>/<contrato>.json` la
     dirección, el commit, la configuración del compilador y los
     argumentos del constructor (equivalente a su `onchain-expected.json`).
2. **Comparación byte a byte** en `scripts/verificar-despliegue.js`:
   - Se compila el commit.
   - Se rellenan los inmutables con los valores esperados en las
     posiciones de `immutableReferences` de `solc`: `verificadorZk`,
     `relayer`, `devModeZk` y, con el ADR 0016, `registroIdeas`.
   - Se compara con `eth_getCode`.
   - Es más estricto que el método de `deployed-contracts`, que sustituye
     cualquier aparición de la dirección del contrato en el código
     (`verify-bytecode.mjs:83-87`): aquí cada valor va en su posición
     exacta.
   - Resultado: `IDÉNTICO`, `IDÉNTICO SALVO METADATOS` o `DISTINTO`. Con
     `DISTINTO` termina con código 1.
3. **Alcance:** todos los contratos propios, sin excepción.
   - En `deployed-contracts`, el `IdeaRegistry` se declara idéntico al
     código fuente sin comparar el bytecode
     (`09-IdeaRegistry/README.md`).
   - Además, el verificador de ZKPassport (dirección oficial) y el Safe del
     [ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md):
     su proxy y su *singleton* comparados con los despliegues oficiales de
     Safe.
4. **Para cualquiera:**
   - Un solo comando, con cualquier RPC (`RPC_URL=… pnpm --filter
     @civora/contracts verificar:<red>`), sin claves.
   - El CI comprueba sin red que la compilación del commit coincide con el
     JSON guardado.
   - Los resultados se publican en
     [despliegue-produccion.md](despliegue-produccion.md#contrato-desplegado).

**Criterios de aceptación:**

- La verificación da `IDÉNTICO` con el contrato de Sepolia actual y
  `DISTINTO` con un artefacto alterado en un byte (test).
- Falla si un inmutable no coincide, por ejemplo con otro relayer.
- El CI falla si la compilación ya no reproduce el JSON guardado.
- Tras migrar a Hardhat 3, el contrato sigue dando `IDÉNTICO` o, si no,
  queda documentado por qué.

## Fase 2: MACI y auditoría externa

**Objetivo:** secreto de papeleta y resistencia a la coacción (hallazgo A-02).

| Tarea | Estado |
|---|---|
| Integrar MACI: votos cifrados y recuento verificable | pendiente |
| Prevalencia del voto presencial sobre el digital | pendiente |
| Estudiar el revoto hasta el cierre sin revelar cuál es el definitivo | pendiente |
| Auditoría externa de contratos y circuitos | pendiente |

**Dependencias:** Fase 1 y paso a producción.

**Criterios de aceptación:** la cadena no expone la opción de ningún voto;
un voto presencial anula el digital previo de la misma persona sin que sea
observable; informe de auditoría externa sin hallazgos críticos abiertos.
