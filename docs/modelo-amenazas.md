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
- **Vinculación voto-identidad**: la prueba ZK certifica que el votante
  cumple los requisitos (DNI español, empadronamiento, 5 años de residencia,
  mayoría de edad) sin revelar quién es.
- **Voto por otra persona**: solo puede generar una prueba válida quien
  posea físicamente el documento de identidad (DNIe/pasaporte con chip NFC),
  cuando se usa la vía ZKPassport. La vía de "datos manuales" (ver más abajo)
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
  respaldo para la demo, no una via de identificacion segura.
- **Certificado digital**: pendiente. Requiere que el servidor negocie TLS
  mutuo con el navegador para leer el certificado (FNMT, Cl@ve...), no
  soportado por la infraestructura serverless actual (Vercel).
- **Dominio de ZKPassport sin registrar**: por defecto se usa el dominio de
  pruebas `demo.zkpassport.id` en modo `devMode`, que acepta pruebas mock.
  Antes de cualquier uso real hay que registrar el dominio propio y
  desactivar `devMode` (ver README).
- **Creación de propuestas sin control de acceso**: cualquiera puede crear
  una propuesta desde `/propuestas/nueva`. Cada creación paga gas con la
  cuenta "relayer" del servidor, así que en un despliegue público alguien
  podría crear propuestas repetidamente y agotar esos fondos. Aceptable
  para una demo en testnet; antes de cualquier uso real hace falta algún
  control (autenticación, límite de tasa, o que solo una cuenta autorizada
  pueda crear propuestas).
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
- Verificación con el Padrón Municipal / INE mediante convenio oficial.
- Estudio de mitigación de coacción (p.ej. permitir revotar hasta el cierre,
  ocultando cuál es el voto "definitivo").
