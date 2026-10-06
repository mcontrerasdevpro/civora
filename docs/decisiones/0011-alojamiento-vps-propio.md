# 0011. Alojamiento en VPS propio con Easypanel

- **Estado:** aceptada
- **Fecha:** 2026-10-06
- **Sustituye:** el alojamiento en Vercel usado hasta la Fase 0

## Contexto

La web se publicaba en Vercel. Para un sistema de voto importan tres cosas
que una plataforma gestionada controla solo en parte: qué versiones de las
dependencias se ejecutan, qué se registra de cada petición (IPs, cabeceras)
y dónde están los datos. Además, la salida de Next en Vercel depende del
entorno de build de la plataforma.

## Decisión

Servir la web desde un VPS propio con Easypanel en
`civora.nexuraia.com`, con una imagen Docker construida desde el
[`Dockerfile`](../../Dockerfile) del repositorio:

- **Builds reproducibles:** imagen base fijada por versión y digest,
  `pnpm install --frozen-lockfile` con la versión de pnpm de
  `packageManager`; nunca otras versiones que las del lockfile.
- **Control de registros:** la aplicación solo registra códigos sin datos
  (`lib/registro.mjs`) y el proxy y Docker se configuran en el propio
  servidor ([modelo de amenazas](../modelo-amenazas.md#registros-del-servidor-y-del-proxy)).
- **Datos en la UE:** VPS alojado en la UE.
- Validaciones de arranque también en la imagen (`arranque.js`), healthcheck
  en `/api/salud` y usuario no root.

Pasos: [despliegue-vps.md](../despliegue-vps.md).

## Alternativas

- **Seguir en Vercel:** sin mantenimiento de servidor, pero con menos
  control sobre registros, ubicación y entorno de build.
- **Otra plataforma gestionada en la UE:** mejora la ubicación, no el
  control de registros ni la reproducibilidad.
- **Kubernetes o similar:** desproporcionado para una PoC.

## Consecuencias

- **Aislamiento:** si el VPS comparte servidor con otros servicios (por
  ejemplo, n8n u otras webs), un fallo o una intrusión en cualquiera de
  ellos, o en Easypanel, puede afectar a Civora, y al revés.
- **Mantenimiento:** actualizaciones del sistema, de Docker, de Easypanel y
  de la imagen base pasan a ser responsabilidad propia; también copias de
  seguridad, cortafuegos y supervisión.
- **Disponibilidad:** un único servidor es un punto único de fallo.
- **Para producción real:** VPS dedicado solo a Civora, endurecido y
  supervisado, con auditoría de su configuración
  ([ROADMAP](../ROADMAP.md#paso-a-producción)).
- `main` despliega en Easypanel ([AGENTS.md](../../AGENTS.md#reglas-de-trabajo));
  Vercel se retira tras completar la migración.
