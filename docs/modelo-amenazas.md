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

**Corregido en el código; pendiente de desplegar el contrato nuevo.** La
prueba ZKPassport acreditaba la elegibilidad para una propuesta, pero no la
opción: quien viera la transacción antes de que se minara (el relayer o un
observador de la mempool) podía reenviarla con otra opción. Ahora la prueba
lleva vinculado `civora-voto:<propuesta>:<opción>` y el contrato rechaza
cualquier otra opción (`OpcionNoVinculada`,
[ADR 0014](decisiones/0014-opcion-vinculada-prueba-zk.md)). Reenviar la
prueba con la misma opción sigue siendo posible y no altera el voto. Hasta
que se despliegue el contrato nuevo, el desplegado en Sepolia sigue expuesto.

La prueba no se verifica en el navegador ni sale hacia terceros: el SDK de
ZKPassport la verificaría consultando un nodo de Alchemy con la prueba (con
nullifier y opción) y la IP del votante, y la subiría a su panel. La web la
envía directamente al contrato y crea el SDK con `disableProofStorage`; la
CSP no permite WebAssembly ni Alchemy.

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
(Semaphore). Hoy solo existe el canal digital autónomo. El punto asistido,
la pista de papel y la auditoría siguen el
[ADR 0019](decisiones/0019-ia-punto-asistido-auditoria.md).

- **Dos canales**: digital autónomo y punto de voto asistido presencial.
  Cada persona queda asignada a **un único canal** al registrarse, antes de
  congelar el censo, para que no pueda votar por dos vías.
- **Sin canal de papel independiente**: no hay voto en papel escrutado por
  actas. Un acta puede estar falseada desde su origen y escanearla no lo
  detecta. El papel solo existe como pista de auditoría dentro del punto
  asistido.
- **Punto de voto asistido**:
  - Identificación con ayuda de personal acreditado y con el lector NFC del
    propio punto, no con el móvil del votante.
  - Voto en solitario en cabina privada, con el equipo en modo quiosco y
    software verificado por su hash. Emite el mismo voto verificable que el
    canal remoto.
  - La identidad Semaphore se genera y se destruye en la misma sesión; no
    queda en el equipo ni la conserva el personal.
  - Acompañante solo si lo elige el votante. Se registra como «voto
    asistido», nunca el contenido del voto.
- **Amenaza: el quiosco envía un voto distinto del elegido.**
  - Mitigación: el quiosco imprime una papeleta sin datos del votante, que
    el votante comprueba antes de que se emita el voto digital, y que cae a
    una urna sellada.
  - Auditorías de limitación de riesgo con observadores comparan las
    papeletas de puntos sorteados con su recuento en cadena.
  - Si no coinciden, la muestra se amplía y el quiosco se precinta. El
    contrato no se modifica; decide el órgano convocante.
- **Amenaza: correlación por la hora del voto en el punto.** El personal
  sabe cuándo vota cada persona; en un punto con poca afluencia, la hora
  del voto en cadena revelaría la opción.
  - Mitigación: el quiosco envía los votos en lotes, con retraso y orden
    aleatorios.
  - La papeleta no lleva hora ni número de orden.
- **Amenaza: un punto manipulado añade votos.**
  - Mitigación: techo por censo en cadena. El contrato rechaza los votos de
    un punto por encima de las personas que tenía asignadas.
  - La auditoría en papel detecta además los cambios de opción dentro del
    techo.
- **Amenaza: alguien se hace pasar por Civora en WhatsApp o Telegram para
  «votar» por mensaje.**
  - Mitigación: esos canales solo dan ayuda y avisos, nunca permiten votar
    ni piden la opción ni documentos.
  - Cada mensaje lo recuerda y la web avisa de que cualquier petición de
    votar por mensaje es un fraude.
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
- **Escuchas ajenas al usar «Escuchar»**: quien esté cerca puede oír la
  opción leída en voz alta. Mitigación: al pulsar «Escuchar» se avisa por
  escrito y por voz («Baje el volumen o use auriculares: otras personas
  cerca de usted podrían oír su voto.») y no se lee nada hasta que la
  persona confirma que lleva auriculares. El navegador no puede detectar
  los auriculares: la confirmación es declarada.
- **Caducidad del reto de certificado**: el servidor da 5 minutos para
  firmar el reto. La interfaz no impone límites de tiempo y, si el reto
  caduca, avisa y permite reintentar sin perder el progreso; eliminar ese
  límite para el voto asistido queda pendiente para la Fase 1.
- **Red de despliegue para producción**: pendiente de decidir
  ([ROADMAP](ROADMAP.md#paso-a-producción)).

## Asistente de IA (futuro, no implementado)

Límites y arquitectura prevista: [ADR 0009](decisiones/0009-limites-asistente-ia.md)
y [ADR 0019](decisiones/0019-ia-punto-asistido-auditoria.md#5-ia-solo-ayuda-y-avisos).
El recuento es siempre determinista y reproducible: la IA nunca cuenta,
decide ni anula votos.

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
  - *Cifras inventadas*: el asistente podría dar un recuento o un
    porcentaje que no existe. Mitigación: toda cifra sale de la API de
    resultados y se cita con su origen; antes del cierre no hay cifras.
  - *Falsas alarmas o alarmas silenciadas en la detección de anomalías*:
    mitigación: solo datos públicos y agregados; reglas deterministas
    primero; la IA solo avisa a personas, con los datos reproducibles, y no
    tiene herramientas para actuar sobre votos.
- **Manipulación del índice de eventos en `civora-db`**
  ([ADR 0020](decisiones/0020-indice-incremental-eventos.md)): quien acceda
  a la base de datos podría borrar o alterar la copia de los eventos de voto.
  - Mitigación: la copia nunca sustituye a la cadena. Las cifras de la
    página salen del contrato, y el recuento de la copia se compara siempre
    con él.
  - Una diferencia se muestra como discrepancia, también en modo sencillo,
    nunca se oculta.
  - El desglose por vía y la lista de transacciones se pueden contrastar
    en el explorador.
  - La copia se reconstruye desde cero con un `TRUNCATE`.
- **Reconocimiento de voz**: la Web Speech API de Chrome envía el audio a
  servidores externos; no se usa para elegir la opción
  ([ADR 0008](decisiones/0008-audios-propios-confirmacion.md)).

### Vías fuera de cadena sobre votaciones abiertas (ADR 0016)

Amenazas del diseño del
[ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md), aún
sin implementar. En cadena, nada del registro de ideas ni del Safe puede
modificar una votación ya creada
([comprobación](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md#comprobación-nada-en-cadena-afecta-a-una-votación-ya-creada)).
Fuera de la cadena hay dos vías para entorpecerla:

| Amenaza | Quién puede | Efecto sin mitigar | Mitigación |
|---|---|---|---|
| **Retirar o falsificar el contenido** de una propuesta aprobada: dejar de fijarlo en los proveedores, borrarlo de `civora-db` o servir otro contenido desde una pasarela | El operador (tiene las credenciales de pinning y de la base de datos), un proveedor o una pasarela | Nadie puede leer qué se vota, o se muestra un texto distinto; si la web exigiera el contenido para votar, la votación quedaría suspendida | Una propuesta aprobada solo deja de fijarse por decisión pública del Safe en cadena, con su motivo (`ContenidoRetirado`), o por orden judicial. Cada fuente (varias pasarelas y `civora-db`) se verifica contra el CID; el contenido que no coincide no se muestra nunca. Si ninguna fuente devuelve contenido válido, la web avisa, muestra el CID y **deja votar**: retirar el contenido nunca detiene la votación. Quien conserve el JSON puede volver a fijarlo |
| **Agotar el gas del relayer** con ideas sin cartera o con ejecuciones de aprobaciones del Safe | Cualquiera, con ideas sin cartera (hasta 20 al día y su límite por IP); el Safe o quien ejecute sus transacciones | Al agotarse el tope diario, el relayer dejaría de enviar votos de las votaciones abiertas hasta el día siguiente | Reserva de 8 € de los 10 € diarios solo para votos; ideas y aprobaciones tienen un subtope de 2 € y se rechazan al agotarlo, sin afectar a los votos. Alerta en cuanto un voto empieza a consumir la reserva ([ADR 0016](decisiones/0016-propuestas-registro-ideas-multifirma-ipfs.md#4-quién-paga-qué)) |

Riesgo residual: el relayer sigue pudiendo dejar de enviar votos (censura
del operador, M-02), y un ataque que agote la reserva con votos válidos
bloquea el resto del día. Lo segundo exige pruebas de identidad válidas, así
que su coste es alto.

## Próximos pasos de seguridad

Las tareas que cierran estas amenazas, con su estado y criterios de
aceptación, están en la [hoja de ruta](ROADMAP.md).
