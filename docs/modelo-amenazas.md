# Modelo de amenazas

Este documento explica, con honestidad, qué problemas resuelve esta prueba
de concepto y cuáles quedan abiertos. Presentar las limitaciones con
claridad es lo que distingue un proyecto serio de "hemos puesto blockchain
y ya es seguro".

## Qué previene el sistema

- **Doble voto**: cada prueba ZK genera un `nullifier` único; el contrato
  rechaza un segundo voto con el mismo nullifier para la misma propuesta.
- **Manipulación del resultado**: el recuento vive en un contrato público,
  auditable por cualquiera; nadie (ni el operador del sistema) puede alterar
  los votos ya emitidos.
- **Vinculación voto-identidad**: en la vía ZKPassport, el propio contrato
  `VotacionAnonima.votarConPruebaZk` verifica la prueba contra el
  RootVerifier oficial de ZKPassport y comprueba nacionalidad española y
  mayoría de edad antes de aceptar el voto — no hay que confiar en que el
  servidor lo haya hecho honestamente. Empadronamiento y 5 años de
  residencia siguen sin comprobarse (ver más abajo).
- **Voto por otra persona**: solo puede generar una prueba válida quien
  posea físicamente el documento de identidad (DNIe/pasaporte con chip NFC),
  cuando se usa la vía ZKPassport, o quien posea el certificado digital
  instalado, cuando se usa esa vía (firma verificada contra la FNMT/DGP en
  `lib/certificado-digital.ts`). La vía de "datos manuales" (ver más abajo)
  no ofrece esta garantía.

## Qué NO resuelve todavía esta PoC

### Front-running de votos ZK (R-01)

**Crítico y abierto.** La prueba ZKPassport acredita la elegibilidad para
una propuesta, pero no la opción. Quien vea la transacción antes de que se
mine (el relayer o un observador de la mempool) puede reenviar la misma
prueba con otra opción; el contrato acepta la primera y rechaza la legítima
por nullifier repetido. Mitigación prevista: atar la opción a la prueba y
verificarla en el contrato. Es la primera prioridad del
[spike ZKPassport](ROADMAP.md#spike-zkpassport-deduplicación-entre-vías);
detalle en la [auditoría](auditoria-seguridad.md).

### Firma y certificado en la vía de certificado

- El servidor recibe la firma CMS y el certificado del votante para
  verificarlos. **No se guardan ni se registran** (logs, base de datos o
  mensajes de error): se descartan tras verificar. Un test lo comprueba con
  un CMS real y un marcador.
- La firma cubre la opción (R-04): no puede reutilizarse para otra.
- La firma tiene que estar hecha con el mismo certificado cuya cadena y DNI
  se validan (C-03): no basta con enviar el certificado público de otra
  persona y firmar con una clave propia.
- El nullifier es un HMAC con un secreto del servidor (R-02): un tercero no
  puede recalcularlo enumerando DNI, pero el operador sí (A-01).

### Registros del servidor y del proxy

La aplicación no registra IPs, cuerpos de petición, firmas, certificados
ni nullifiers: solo `lib/registro.mjs` escribe en la consola, y solo un
contexto fijo y un código corto (lo comprueba
`apps/web/test/despliegue.test.mjs`). La IP solo se usa en memoria para el
rate limit de creación de propuestas.

Fuera de la aplicación sí puede quedar rastro:

- **Proxy de Easypanel (Traefik):** si tiene activados los *access logs*,
  registra IP, ruta, user-agent y hora de cada petición. Combinados con la
  hora de un voto en la cadena, permitirían relacionar una IP con un
  nullifier. Mitigación: desactivar los access logs del proxy o, si se
  necesitan, excluir la IP del cliente y las cabeceras, y retenerlos el
  mínimo tiempo; revisarlo tras cada actualización de Easypanel.
- **Docker:** la salida del contenedor se guarda en el servidor. Mitigación:
  rotación de registros (`max-size` y `max-file` del controlador de logs) y
  acceso al servidor restringido.
- **Proveedor del VPS y DNS/CDN:** pueden registrar conexiones. Mitigación:
  proveedor en la UE con contrato de encargo de tratamiento y sin CDN que
  inspeccione el tráfico, o con sus registros desactivados.
- **Proveedor RPC:** ve las transacciones del relayer, no la IP del
  votante.

Ver [ADR 0011](decisiones/0011-alojamiento-vps-propio.md) y
[despliegue-vps.md](despliegue-vps.md).

### Otras limitaciones

- **Verificación real de empadronamiento y de los 5 años de residencia**:
  el chip NFC del DNIe/pasaporte no contiene estos datos; requiere acceso
  oficial al Padrón Municipal / INE, no disponible en una PoC. Se acepta
  como declaración responsable del votante.
- **Vía de "datos manuales"**: retirada de la interfaz y la API en la
  Fase 0 ([ADR 0006](decisiones/0006-eliminacion-via-manual.md)); el contrato
  conserva `votarManual` solo para el relayer hasta la Fase 1.
- **Requisitos de elegibilidad fijos en el contrato**: `EDAD_MINIMA` y la
  nacionalidad exigida (España) están fijados como constantes en
  `VotacionAnonima.sol`, iguales para todas las propuestas. Personalizar
  estos requisitos por propuesta (como ya permite el esquema de datos)
  requeriría guardarlos también on-chain y pasarlos a
  `votarConPruebaZk`, pendiente.
- **Certificado digital: no prueba la edad**. Un certificado personal
  (FNMT, DNIe) no lleva la fecha de nacimiento, así que esta vía solo prueba
  identidad (con fuerza real, vía firma verificada), no mayoría de edad; se
  acepta autodeclarada, igual que en la vía manual.
- **Certificado digital: revocación solo por OCSP, sin CRL de respaldo**.
  Se consulta el respondedor OCSP que declara el propio certificado
  (extensión Authority Information Access) y se rechaza el voto si consta
  como revocado. Por defecto, si esa consulta no se puede completar
  (certificado sin URL de OCSP, respondedor caído, tiempo agotado...) el
  voto también se rechaza (fallo cerrado) — más seguro, pero significa que
  un respondedor OCSP caído bloquearía esta vía por completo. Esto no se ha
  podido probar contra los respondedores reales de la FNMT/DGP, solo con
  certificados sintéticos: si en producción resulta poco fiable, hay una
  variable de entorno (`FALLO_ABIERTO_REVOCACION=true`) para aceptar el
  voto cuando la comprobación no se pueda completar, sin dejar de rechazar
  un certificado que sí conste como revocado.
- **Certificado digital: requiere Autofirma instalada**, la herramienta de
  escritorio del Gobierno de España; no funciona sin ella.
- **Dominio de ZKPassport sin registrar**: por defecto se usa el dominio de
  pruebas `demo.zkpassport.id` en modo `devMode`, que acepta pruebas mock.
  Antes de cualquier uso real hay que registrar el dominio propio y
  desactivar `devMode` (ver README).
- **Creación de propuestas abierta en la demo**: `/propuestas/nueva` no
  pide clave; solo hay un límite de 5 propuestas por IP cada 15 minutos,
  en memoria. Cualquiera puede gastar saldo del relayer en Sepolia y
  publicar contenido sin moderar. Antes de producción real hace falta
  autorización con cuentas individuales
  ([auditoría, M-04](auditoria-seguridad.md#m-04--medio--creación-de-propuestas-sin-autorización-riesgo-aceptado-en-la-demo)).
- **Coacción o compra de voto**: el sistema no puede impedir que alguien
  vote bajo presión en el momento de emitir el voto (problema abierto en
  todo el e-voting remoto, no exclusivo de este proyecto). La coacción
  familiar o de cuidadores se trata en
  [Inclusión y voto asistido](#inclusión-y-voto-asistido).
- **Disponibilidad/DoS**: no se ha diseñado todavía la resiliencia de la
  infraestructura ante ataques de denegación de servicio.
- **Legalidad**: el voto electrónico vinculante en España está limitado por
  la LOREG; esta PoC es una demostración técnica, no un sistema habilitado
  legalmente para elecciones oficiales.

## Inclusión y voto asistido

Diseño acordado; los canales y la asignación se implementan en la Fase 1
(Semaphore). Hoy solo existe el canal digital autónomo.

- **Tres canales**: digital autónomo, punto de voto asistido presencial y
  papel. Cada persona queda asignada a **un único canal** al registrarse,
  antes de congelar el censo, para que no pueda votar por dos vías.
- **Punto de voto asistido**:
  - Identificación con ayuda de personal acreditado y con el lector NFC del
    propio punto, no con el móvil del votante.
  - Voto en cabina privada, con el equipo en modo quiosco.
  - La identidad Semaphore se genera y se destruye en la misma sesión; no
    queda en el equipo ni la conserva el personal.
  - Acompañante solo si lo elige el votante. Se registra como «voto
    asistido», nunca el contenido del voto.
- **Teléfono de ayuda**: resuelve dudas del proceso y nunca pregunta ni
  registra el sentido del voto.
- **Amenaza: coacción familiar o de cuidadores en el voto remoto.** Quien
  convive con el votante o lo cuida puede presionarlo o votar en su lugar
  desde casa.
  - Mitigación actual (diseño, Fase 1): la asignación de canal permite que
    la persona en riesgo vote en un punto asistido, fuera del entorno que
    la presiona.
  - Mitigación futura (Fase 2, MACI): el voto presencial prevalece sobre el
    digital, de modo que un voto remoto forzado puede anularse en persona
    sin que el coaccionador lo sepa.
- **Síntesis de voz en la web**: las voces en red de algunos navegadores
  (por ejemplo, las voces «Google» de Chrome) envían el texto a servidores
  externos y filtrarían el voto si leyeran la opción. Mitigación: solo voces
  locales y audios propios para la confirmación
  ([ADR 0008](decisiones/0008-audios-propios-confirmacion.md)).
- **Caducidad del reto de certificado**: el servidor da 5 minutos para
  firmar el reto. La interfaz no impone límites de tiempo y, si el reto
  caduca, avisa y permite reintentar sin perder el progreso; eliminar ese
  límite para el voto asistido queda pendiente para la Fase 1.
- **Red de despliegue para producción**: pendiente de decidir
  ([ROADMAP](ROADMAP.md#paso-a-producción)).

## Asistente de IA (futuro, no implementado)

Límites y arquitectura prevista: [ADR 0009](decisiones/0009-limites-asistente-ia.md).

- **Amenazas**:
  - *Fuga del voto a proveedores de IA*: cualquier texto, audio o contexto
    que llegue al modelo puede revelar la opción. Mitigación: desconexión
    en el paso de votar y modelo en la UE o local.
  - *Sesgo o persuasión*: el modelo puede inclinar la decisión al resumir o
    responder. Mitigación: solo lectura literal o resúmenes neutrales
    aprobados de antemano; prohibido opinar.
  - *Inyección de instrucciones vía contenido*: un texto de propuesta
    manipulado podría dar órdenes al modelo. Mitigación: contenido firmado
    y ninguna herramienta con efecto sobre el voto.
  - *Reglamento europeo de IA*: un sistema de IA que influya en el voto
    entra en la categoría de alto riesgo. El diseño evita esa influencia;
    si no pudiera garantizarse, el asistente no se despliega.
- **Reconocimiento de voz**: la Web Speech API de Chrome envía el audio a
  servidores externos; no se usa para elegir la opción
  ([ADR 0008](decisiones/0008-audios-propios-confirmacion.md)).

## Próximos pasos de seguridad

Las tareas que cierran estas amenazas, con su estado y criterios de
aceptación, están en la [hoja de ruta](ROADMAP.md).
