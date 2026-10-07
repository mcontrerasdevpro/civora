# 0015. Condiciones para votar y contraste con organismos públicos

- **Estado:** aceptada (requisito); conexiones pendientes de convenio
- **Fecha:** 2026-10-07
- **Relacionada:** [ADR 0005](0005-no-publicar-nif.md), [ADR 0014](0014-opcion-vinculada-prueba-zk.md), [Fase 1](../ROADMAP.md#fase-1-semaphore)

## Contexto

Para votar hay que cumplir cuatro condiciones:

1. Tener la nacionalidad española.
2. Estar empadronado en España.
3. Ser mayor de 18 años.
4. Tener un documento español: DNI o pasaporte.

Hoy solo una parte se contrasta con una fuente oficial:

| Condición | DNIe o pasaporte (ZKPassport) | Certificado (Autofirma) |
|---|---|---|
| Nacionalidad española | Se lee del chip; el contrato la comprueba | Implícita: solo se aceptan certificados con DNI, que solo se expide a españoles |
| Documento español | Se lee del chip (DNI o pasaporte con nacionalidad `ESP`) | NIF de DNI y cadena hasta FNMT o DGP |
| Mayor de 18 años | Se lee del chip; el contrato la comprueba | **Declarada a mano, sin contrastar**: el certificado no lleva la fecha de nacimiento |
| Empadronamiento en España | **No se comprueba** | **No se comprueba** |

Los datos que faltan (fecha de nacimiento de quien vota con certificado y
padrón) solo los tienen la Dirección General de la Policía (DGP), el INE y
los ayuntamientos. Su consulta está reservada a administraciones públicas,
con base legal, a través de la Plataforma de Intermediación de Datos (PID)
de la Secretaría General de Administración Digital (SGAD).

## Decisión

- **Las cuatro condiciones son obligatorias** y cada una debe contrastarse
  con la fuente oficial competente. Si alguna no se cumple o no puede
  comprobarse, **el voto no se emite** (fallo cerrado).
- **Un dato declarado a mano no basta.** La fecha de nacimiento declarada
  debe coincidir con la de la fuente oficial; si no coincide, se rechaza.
- **El contraste se hace al formar el censo, no al votar.** La autoridad
  convocante consulta las fuentes oficiales y forma el censo. El votante se
  registra demostrando que es una persona de ese censo, y el censo se
  congela antes de abrir la votación (Fase 1, Semaphore). Así ningún
  servicio ve a la vez la identidad y la opción, y no se consulta a la DGP
  ni al INE en cada voto.
- Se acepta el **pasaporte español** como documento, además del DNI.

## Conexiones obligatorias con organismos públicos

Todas requieren que la autoridad convocante sea una administración pública
(o actúe por encargo de una) y tramite su adhesión o convenio. Los nombres
de los servicios son los del catálogo de la PID; la disponibilidad exacta y
los datos de cada respuesta se confirman con la SGAD al tramitar el alta.

| # | Organismo | Servicio | Para qué | Vía |
|---|---|---|---|---|
| 1 | Dirección General de la Policía (Ministerio del Interior) | Servicio de Verificación de Datos de Identidad (SVDI) | DNI vigente, nacionalidad y fecha de nacimiento (edad); contraste de la edad declarada | PID (SGAD) |
| 2 | Dirección General de la Policía | Consulta de pasaporte español vigente | Aceptar el pasaporte como documento. **A confirmar** si la PID lo ofrece o requiere convenio directo con la DGP | PID o convenio con la DGP |
| 3 | Instituto Nacional de Estadística (INE) | Consulta de datos de residencia con fecha de última variación padronal (SECOPA) | Empadronamiento vigente en España | PID (SGAD) |
| 4 | INE | Consulta del histórico de residencia | Antigüedad del empadronamiento, si la convocatoria exige años de residencia | PID (SGAD) |
| 5 | Ayuntamiento convocante | Padrón municipal | Censo de una consulta local, si la convoca un ayuntamiento | Acceso directo del propio ayuntamiento |
| 6 | INE, Oficina del Censo Electoral | Censo electoral | Solo para procesos regulados por la LOREG; no es consultable por terceros y queda fuera del alcance de esta PoC | Convenio específico, si procede |
| 7 | FNMT-RCM y DGP | OCSP de certificados | Revocación del certificado | **Ya integrado** (`lib/certificado-digital.ts`) |

**Requisitos legales y técnicos de las conexiones (1 a 6):**

- Base jurídica del tratamiento: misión de interés público o poder público
  (RGPD art. 6.1.e) atribuido a la autoridad convocante; derecho a no
  aportar datos que ya tiene la Administración (Ley 39/2015, art. 28).
- Evaluación de impacto (EIPD) y registro de actividades de tratamiento.
- Esquema Nacional de Seguridad (RD 311/2022) en la categoría que
  corresponda; certificado de sede o de componente para firmar las
  consultas.
- Cada consulta queda registrada en la PID con su finalidad y expediente.
- Minimización: el censo guarda solo lo necesario para el registro, nunca el
  NIF publicado ni hashes directos del DNI ([ADR 0005](0005-no-publicar-nif.md)).

## Alternativas

- **Consultar la DGP y el INE en cada voto:** el servicio que consulta
  sabría quién vota en el momento de votar, y depende de que las fuentes
  respondan en ese instante.
- **Aceptar datos declarados:** incumple la decisión; solo vale en la demo,
  señalado como tal.
- **Exigir solo ZKPassport:** cubre nacionalidad, edad y documento desde el
  chip, pero no el empadronamiento, y excluye a quien no tiene móvil con NFC.

## Consecuencias

- **Hasta tener las conexiones 1 y 3, ninguna vía cumple las cuatro
  condiciones:** el empadronamiento no se comprueba en ninguna. La demo
  pública sigue sin ser apta para votaciones reales ni vinculantes.
- En la vía de certificado, la edad declarada no puede contrastarse hasta
  tener la conexión 1. Decidido (2026-10-07): en la demo de pruebas la vía
  de certificado se mantiene con la edad declarada, y la elegibilidad sigue
  incluyendo la residencia de 5 años, hasta que los organismos aprueben las
  conexiones.
- La Fase 1 depende de que una administración pública actúe como autoridad
  convocante y tramite las conexiones.
