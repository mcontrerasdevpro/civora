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

## Fase 1: Semaphore

**Objetivo:** voto anónimo por pertenencia a un censo congelado, con un
único mecanismo de deduplicación para todas las vías (hallazgos A-01, A-03 y
A-04).

| Tarea | Estado |
|---|---|
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
| Validar la vía ZK con un DNIe o pasaporte real: requiere red principal (Base o Ethereum), tope de gasto del relayer y autorización para crear propuestas | pendiente: a la espera de la aprobación de los organismos públicos ([ADR 0015](decisiones/0015-condiciones-voto-organismos-publicos.md)) |
| Script `verificar:sepolia` que compara relayer, dominio y `devMode` del contrato desplegado | hecho |
| Imagen Docker reproducible, `/api/salud`, registros sin datos y job «Imagen Docker» en CI ([ADR 0011](decisiones/0011-alojamiento-vps-propio.md)) | hecho; CI en verde en GitHub |
| Un solo servicio `civora` en Easypanel (proyecto `nexuraia`), primero en `actualizar-dependencias` y tras fusionar en `main` ([despliegue-vps.md](despliegue-vps.md#3-un-solo-servicio)) | hecho: *Source* en `main` (2026-10-07); durante la prueba de R-01, en su rama |
| Contrato en Sepolia `0x628901F7bC5Ab55c8b6289a05F0AD543DA94Bdb7` (con R-01; sustituye a `0xDCfe…FC3C`) (dominio `civora.nexuraia.com`, `devMode` desactivado), verificado con `verificar:sepolia`; la demo usa el de demostración | hecho |
| Desactivar los access logs del proxy (o excluir la IP) y rotar los registros de Docker | pendiente |
| Cada propuesta guarda el contrato con el que se creó: las de contratos anteriores no se listan, no admiten votos y avisan con un 410; rechazos del contrato sin mensaje propio, con 400 y selector registrado (rama `feat/propuestas-por-contrato`) | hecho |
| Panel de Easypanel con dominio y HTTPS (hoy en `http://<IP>:3000`) y puerto 3000 cerrado en el firewall del VPS | pendiente |
| *Auto Deploy* con webhook de GitHub creado a mano: el token de Easypanel no puede gestionar webhooks (403); la URL del webhook es secreta | pendiente |
| Creación de propuestas abierta en la demo, sin `ADMIN_SECRET` (M-04 como riesgo aceptado) | hecho |
| Volver a exigir autorización (cuentas individuales) y un tope de gasto del relayer antes de producción real | pendiente |
| Demo de pruebas: la vía de certificado mantiene la edad declarada y se mantiene la residencia de 5 años en la elegibilidad, hasta tener las conexiones con DGP e INE ([ADR 0015](decisiones/0015-condiciones-voto-organismos-publicos.md)) | decidido (2026-10-07) |
| Postgres de la demo en el VPS (`civora-db`, sin puerto externo) ([ADR 0013](decisiones/0013-postgres-en-el-vps.md)) | hecho; pendiente de revisar en producción |
| Copias de seguridad automáticas y probadas de la base de datos, antes de producción real | pendiente |
| Retirar la base de Neon cuando se valide la del VPS | pendiente |
| Retirar Vercel tras completar la migración | en curso: desconectado de GitHub, ya no despliega |
| Para producción real: VPS dedicado solo a Civora, endurecido y supervisado | pendiente |
| Entorno de pruebas separado (contrato y dominio propios), con el VPS dedicado | pendiente |
| Dependencias: Next 15.5.27 y React 19.2.8, sin `node-forge` en runtime, `pnpm audit --prod` limpio y Dependabot agrupado ([ADR 0012](decisiones/0012-next-15-react-19.md)) | hecho |
| CSP con nonce en todas las páginas (renderizado dinámico), resultados «no disponibles» sin 500, `Referrer-Policy: no-referrer` y E2E de todas las páginas ([auditoría](auditoria-seguridad.md#revisión-en-producción-2026-10-07-rama-actualizar-dependencias)) | hecho; pendiente de revisar en producción |
| CSP que permite abrir Autofirma (`wss`/`https` a `127.0.0.1` y `frame-src afirma:`), E2E sin simulacro de la conexión y favicon ([auditoría](auditoria-seguridad.md#csp-y-autofirma-2026-10-07-rama-fixcsp-autofirma)) | hecho; firmado con Autofirma y certificado real en producción con Edge y Brave (2026-10-07); pendiente de probar en Firefox |
| Revisión completa del PR #5: C-03 (firma atada al certificado validado), aviso de recibo antes del cierre y título de resultados ([auditoría](auditoria-seguridad.md#revisión-del-pr-5-2026-10-07-rama-fixrevision-pr5)) | hecho |
| Revisar los 4 avisos de desarrollo sin parche (`braces`, `node-forge` en tests, `sprintf-js`, `elliptic`) al migrar a Hardhat 3 | pendiente |
| Next 16 como tarea propia (versión mayor) | pendiente |
| `@zkpassport/sdk` 0.18.2 o posterior como tarea propia: compatibilidad con el verificador del contrato y prueba con un documento real (la 0.18.0 se publicó rota, PR #12) | pendiente |
| TypeScript 7 y `@types/node` acorde al Node de ejecución, como tareas propias (Dependabot ignora sus versiones mayores) | pendiente |
| Decidir la red: Base u otra red principal, o red permisionada (ADR) | pendiente |
| Retirar `CIVORA_DEMO_TESTNET` al pasar a una red principal | pendiente |
| Protección de `main` en GitHub (checks obligatorios «Tests, typecheck, build y E2E» e «Imagen Docker») | hecho |
| CI con tests de contratos y web, typecheck, build y `test:e2e` (`.github/workflows/ci.yml`) | hecho; en verde en GitHub |
| Rate limit compartido entre instancias (hoy en memoria) | pendiente |
| Dominio ZKPassport propio registrado y `DEV_MODE=false` | pendiente |
| Probar OCSP contra los respondedores reales de FNMT/DGP y añadir CRL de respaldo | pendiente |

**Dependencias:** ninguna para CI y protección de `main`; la red, antes de
la Fase 1 en producción.

**Criterios de aceptación:** un PR a `main` no puede fusionarse sin CI en
verde; `https://civora.nexuraia.com/api/salud` responde y el servicio de
producción apunta al contrato de la red elegida; los registros del proxy no
contienen IPs de votantes; dos instancias comparten el límite de intentos
(test).

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
