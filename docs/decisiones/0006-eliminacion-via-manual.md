# 0006. Eliminación de la vía de voto manual

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

La vía manual aceptaba un número de DNI y una fecha de nacimiento escritos a
mano. Solo validaba el formato, calculaba un nullifier enumerable y
permitía votar sin poseer ningún documento (hallazgo C-01).

## Decisión

Se retira la vía manual de la interfaz y de la API. Solo quedan ZKPassport
y certificado digital. La función `votarManual` del contrato se conserva
únicamente para la vía de certificado y solo la puede llamar el relayer
([ADR 0004](0004-relayer-inmutable.md)).

## Alternativas

- **Mantenerla como respaldo de la demo:** facilitaba las pruebas, pero
  rompía todas las garantías de elegibilidad y unicidad.

## Consecuencias

- Quien no tenga DNIe con NFC ni certificado digital no puede votar en el
  canal digital; el voto asistido y en papel se diseñan en la
  [Fase 1](../ROADMAP.md#fase-1-semaphore).
- `votarManual` se elimina del contrato en la Fase 1.
