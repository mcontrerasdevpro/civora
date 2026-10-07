# 0013. Postgres de la demo en el VPS

- **Estado:** aceptada
- **Fecha:** 2026-10-07
- **Sustituye:** Neon como base de datos de la demo pública (Neon sigue siendo válido en local)

## Contexto

La base de datos solo guarda el contenido de cada propuesta (título,
pregunta, opciones, fechas y elegibilidad). No guarda datos de votantes:
los votos, los nullifiers y el hash de cada propuesta están en el contrato.
Al desplegar el contrato nuevo, la base de Neon se quedó con 3 propuestas
del contrato anterior, huérfanas. La web ya se sirve desde el VPS
([ADR 0011](0011-alojamiento-vps-propio.md)).

## Decisión

En la demo pública, Postgres corre como servicio `civora-db` de Easypanel,
en el mismo proyecto `nexuraia` que la web:

- **Sin puerto expuesto:** solo es accesible desde la red interna de Docker.
- **Sin TLS en la red interna:** `DATABASE_URL` termina en
  `?sslmode=disable`. En `pg` 8.23, el `sslmode` de la URL prevalece sobre
  la opción `ssl` de `lib/db.ts`, así que no hace falta cambiar el código.
- **Sin copias de seguridad** mientras sea una demo.
- La tabla `propuestas` se crea sola en la primera petición.

Pasos: [despliegue-vps.md](../despliegue-vps.md#base-de-datos-civora-db).

## Alternativas

- **Seguir en Neon con una base nueva:** sin mantenimiento ni servidor
  propio, pero los datos salen del VPS y dependen de un tercero.
- **Borrar las propuestas huérfanas en Neon:** resuelve los datos, no la
  dependencia.

## Consecuencias

- **Pérdida de datos:** sin copias, perder el volumen borra el contenido de
  las propuestas. Los votos siguen en el contrato, pero las propuestas
  quedan huérfanas y su contenido solo puede contrastarse con el hash del
  contrato si se conserva por otra vía.
- **Aislamiento:** el VPS es compartido (ADR 0011); un fallo en otro
  servicio o en Easypanel puede afectar a la base de datos.
- **Tráfico sin cifrar** entre la web y la base, limitado a la red interna
  de Docker del mismo servidor.
- **Para producción real:** copias de seguridad automáticas y probadas,
  TLS o red aislada, y VPS dedicado
  ([ROADMAP](../ROADMAP.md#paso-a-producción)).
- **Vuelta atrás:** la base de Neon se conserva hasta validar el cambio;
  volver es cambiar `DATABASE_URL`.
