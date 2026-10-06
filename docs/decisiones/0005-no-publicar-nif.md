# 0005. Nunca publicar el NIF ni hashes directos del DNI

- **Estado:** aceptada
- **Fecha:** 2026-10-05; actualizada el 2026-10-06 (R-02, R-03)

## Contexto

Un DNI tiene un espacio de búsqueda pequeño (8 cifras y una letra de
control). Un hash sin secreto, como `SHA-256(propuestaId:DNI)`, se invierte
por enumeración en poco tiempo y revela quién ha votado y qué.

## Decisión

Ningún dato publicado (cadena, API, registros) contendrá el NIF ni un hash
directo del NIF o del número de documento.

Medida provisional hasta la Fase 1 (R-02): el nullifier de certificado es
`HMAC-SHA256(NULLIFIER_CERTIFICADO_SECRET, propuestaId:certificado:DNI)`,
con el DNI normalizado (R-03), y la nota on-chain de `votarManual` es solo
`"certificado"`.

## Alternativas

- **HMAC con secreto del servidor (adoptada como provisional):** impide la
  enumeración a terceros, pero el operador puede seguir vinculando
  identidad y voto.
- **Hash directo:** era la implementación anterior; descartado por
  enumerable.

## Consecuencias

- **Deuda abierta:** el operador, que conoce el secreto, puede recalcular
  el nullifier a partir del DNI (hallazgo A-01 de la
  [auditoría](../auditoria-seguridad.md)). Debe sustituirse por un mecanismo
  anónimo antes de cualquier uso real ([Fase 1](../ROADMAP.md#fase-1-semaphore)).
- **El secreto no puede cambiar ni perderse durante la vida de un
  contrato:** la misma persona obtendría otro nullifier y podría votar dos
  veces. Rotarlo o perderlo exige desplegar un contrato nuevo
  ([despliegue](../despliegue-produccion.md)).
- La deduplicación entre vías no puede basarse en el NIF
  ([spike ZKPassport](../ROADMAP.md#spike-zkpassport-deduplicación-entre-vías)).
