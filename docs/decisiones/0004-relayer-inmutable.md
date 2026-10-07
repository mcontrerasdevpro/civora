# 0004. Relayer inmutable

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

El votante no tiene ni debe necesitar una wallet. Las transacciones las
firma y paga una cuenta del servidor (relayer). Antes de la Fase 0,
cualquiera podía llamar a `votarManual` y a `crearPropuesta`.

## Decisión

La dirección del relayer se fija como `immutable` en el constructor. Solo
esa dirección puede crear propuestas y emitir votos de certificado
(`votarManual`). Debe corresponder a `HARDHAT_RELAYER_PRIVATE_KEY` de la web;
el despliegue en redes no locales exige `RELAYER_ADDRESS`.

## Alternativas

- **Rol de administrador modificable (`owner`):** permite rotar la clave,
  pero añade un privilegio capaz de cambiar quién vota.
- **Sin restricción:** era el estado inicial (hallazgo C-01).

## Consecuencias

- Rotar la clave del relayer exige desplegar otro contrato y actualizar
  el servicio de despliegue ([AGENTS.md](../../AGENTS.md#reglas-de-trabajo)).
- El relayer concentra confianza y permite correlacionar metadatos
  (hallazgo M-02 de la [auditoría](../auditoria-seguridad.md)).
- `votarManual` desaparece en la [Fase 1](../ROADMAP.md#fase-1-semaphore).
