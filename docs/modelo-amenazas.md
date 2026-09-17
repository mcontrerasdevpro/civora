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
- **Certificado digital: sin comprobación de revocación**. La verificación
  comprueba que el certificado encadena hasta la FNMT o la DGP y que no ha
  caducado, pero no consulta OCSP/CRL: un certificado revocado (p.ej. tras
  perder el DNIe) seguiría siendo aceptado hasta que caduque por sí solo.
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
  todo el e-voting remoto, no exclusivo de este proyecto).
- **Disponibilidad/DoS**: no se ha diseñado todavía la resiliencia de la
  infraestructura ante ataques de denegación de servicio.
- **Legalidad**: el voto electrónico vinculante en España está limitado por
  la LOREG; esta PoC es una demostración técnica, no un sistema habilitado
  legalmente para elecciones oficiales.

## Próximos pasos de seguridad

- Auditoría externa de los contratos y del circuito ZK antes de cualquier
  uso real.
- Comprobación de revocación (OCSP/CRL) de los certificados digitales.
- Verificación con el Padrón Municipal / INE mediante convenio oficial.
- Estudio de mitigación de coacción (p.ej. permitir revotar hasta el cierre,
  ocultando cuál es el voto "definitivo").
