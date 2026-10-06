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

- **Verificación real de empadronamiento y de los 5 años de residencia**:
  el chip NFC del DNIe/pasaporte no contiene estos datos; requiere acceso
  oficial al Padrón Municipal / INE, no disponible en una PoC. Se acepta
  como declaración responsable del votante.
- **Vía de "datos manuales"**: cuando el votante no tiene DNIe con NFC,
  /votar permite introducir el número de DNI y la fecha de nacimiento a
  mano. Solo se valida el formato (letra de control del DNI) y que la edad
  declarada sea suficiente; no hay ninguna comprobación de que el
  documento exista o pertenezca a quien lo introduce. Es una vía de
  respaldo para la demo, no una via de identificacion segura. Ademas,
  comparte el mismo espacio de nullifiers que la vía ZKPassport: en teoría,
  alguien que conociera de antemano el identificador único que un DNIe
  concreto generaría para una propuesta podría "reservarlo" por la vía
  manual y bloquear ese voto — requeriría conocer ese identificador sin
  poseer el documento, algo que hoy no se sabe hacer, pero es una
  simplificación de diseño, no una garantía demostrada.
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
- **Creación de propuestas protegida por una única clave compartida**:
  `/propuestas/nueva` exige `ADMIN_SECRET`, pero es una clave compartida sin
  usuarios individuales ni caducidad — quien la tenga puede crear
  propuestas indefinidamente, y no hay forma de revocar el acceso a una
  sola persona sin cambiar la clave para todos. Suficiente para una demo
  con un solo operador; antes de varios administradores reales haría falta
  un sistema de cuentas de verdad.
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
- **Síntesis de voz en la web**: el botón «Escuchar» del modo sencillo solo
  usa voces del sistema marcadas como locales (`localService`). Las voces
  en red de algunos navegadores (por ejemplo, las voces «Google» de Chrome)
  envían el texto a servidores externos; si no hay voz local, el botón se
  oculta con un aviso. La confirmación de la opción elegida no pasa nunca
  por `speechSynthesis`: usa audios pregrabados servidos desde nuestro
  propio origen. Los audios actuales son provisionales, generados con una
  voz local; en producción se sustituirán por grabaciones profesionales.
- **Caducidad del reto de certificado**: el servidor da 5 minutos para
  firmar el reto. La interfaz no impone límites de tiempo y, si el reto
  caduca, avisa y permite reintentar sin perder el progreso; eliminar ese
  límite para el voto asistido queda pendiente para la Fase 1.
- **Pendiente de decidir para producción**: la red de despliegue (Base u
  otra red principal, o una red permisionada).

## Asistente de IA (futuro, no implementado)

Regla: **la IA ayuda con el proceso, nunca con la decisión, y nunca toca la
papeleta.**

- **Puede**: guiar la identificación, responder dudas del proceso, ayudar a
  navegar y leer literalmente la propuesta o un resumen neutral aprobado de
  antemano.
- **No puede**: conocer, sugerir ni confirmar la opción; tener herramientas
  para votar ni acceso a la identidad, al contrato o al relayer; opinar
  sobre la propuesta.
- **Arquitectura prevista**: servicio aislado de la aplicación de voto. Se
  desconecta en el paso de votar y lo anuncia; la elección se hace con una
  interfaz determinista sin IA. Modelo alojado en la UE o local, registros
  sin datos de la sesión de voto y contenido de las propuestas firmado.
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
- **Nota técnica**: el reconocimiento de voz de la Web Speech API en Chrome
  envía el audio a servidores externos. No se usará nunca para seleccionar
  la opción de voto.

## Próximos pasos de seguridad

- Auditoría externa de los contratos y del circuito ZK antes de cualquier
  uso real.
- Probar la comprobación OCSP contra los respondedores reales de la
  FNMT/DGP (solo probada con certificados sintéticos) y añadir CRL como
  respaldo cuando OCSP no esté disponible.
- Verificación con el Padrón Municipal / INE mediante convenio oficial.
- Estudio de mitigación de coacción (p.ej. permitir revotar hasta el cierre,
  ocultando cuál es el voto "definitivo").
