# 0005. Nunca publicar el NIF ni hashes directos del DNI

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

Un DNI tiene un espacio de búsqueda pequeño (8 cifras y una letra de
control). Un hash sin secreto, como `SHA-256(propuestaId:DNI)`, se invierte
por enumeración en poco tiempo y revela quién ha votado y qué.

## Decisión

Ningún dato publicado (cadena, API, registros) contendrá el NIF ni un hash
directo del NIF o del número de documento.

## Alternativas

- **Hash con sal secreta del servidor:** dificulta la enumeración a
  terceros, pero el operador puede seguir vinculando identidad y voto.
- **Hash directo:** descartado por enumerable.

## Consecuencias

- **Deuda abierta:** la vía de certificado deriva hoy su nullifier público
  del NIF en el servidor (hallazgo A-01 de la
  [auditoría](../auditoria-seguridad.md)). Debe sustituirse por un mecanismo
  anónimo antes de cualquier uso real ([Fase 1](../ROADMAP.md#fase-1-semaphore)).
- La deduplicación entre vías no puede basarse en el NIF
  ([spike ZKPassport](../ROADMAP.md#spike-zkpassport-deduplicación-entre-vías)).
