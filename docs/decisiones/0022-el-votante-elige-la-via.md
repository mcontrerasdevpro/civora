# 0022. El votante puede elegir la vía (riesgo de doble voto aceptado en la demo)

- **Estado:** aceptada (temporal; revisar al llegar a la Fase 1)
- **Fecha:** 2026-10-09
- **Matiza:** [ADR 0021](0021-una-sola-via-y-alertas-de-fraude.md), que exigía una sola vía por votación

## Contexto

Con el ADR 0021, cada votación admite una sola vía, por defecto la de
certificado. El responsable quiere que, de momento, el votante pueda elegir
entre certificado y ZKPassport en la misma votación, y decidir más adelante
cómo volver a una sola vía.

Sigue siendo cierto lo que motivó el ADR 0021: no existe un identificador
común entre las dos vías. Con las dos abiertas, la misma persona puede votar
una vez con cada una, y nada lo detecta, ni el contrato ni las alertas de
fraude, porque son dos votos distintos y válidos.

## Decisión

- La vía de una propuesta puede ser también **`Ambas`** (`Via { Certificado,
  Zk, Ambas }`), fijada en el contrato al crearla. Con `Ambas` se aceptan
  `votarManual` y `votarConPruebaZk`. Con las otras dos, todo sigue como en
  el ADR 0021.
- En la web, con `VIAS_HABILITADAS=certificado,zk`, el formulario de crear
  propuesta ofrece «El votante elige» (por defecto), «Certificado digital» y
  «DNIe o pasaporte con ZKPassport». «El votante elige» avisa del doble voto.
  Con una sola vía habilitada no hay elección.
- La página de voto ofrece las vías de la propuesta: con `Ambas`, las dos
  tarjetas.
- Contrato de demostración nuevo en Sepolia:
  `0xE1aF107F364aAd4A01ACDceA30D76E52E8718F05` (bloque 11878179), con los
  mismos parámetros que el anterior.

## Consecuencias

- **En las propuestas `Ambas`, la misma persona puede votar dos veces**: una
  con certificado y otra con ZKPassport. Sus resultados no son fiables para
  un uso real. Es un riesgo aceptado mientras sea una demo en Sepolia, donde
  ZKPassport solo admite pasaportes simulados.
- Cada vía sigue rechazando su propio nullifier repetido, y las alertas de
  fraude siguen contando esos intentos.
- Las propuestas de una sola vía mantienen las garantías del ADR 0021.
- **Pendiente:** decidir cómo volver a una sola vía o cómo deduplicar entre
  vías. La solución completa es el censo con registro único de la
  [Fase 1](../ROADMAP.md#fase-1-semaphore).

## Verificación

- Contrato:
  - Con `Ambas`, se aceptan certificado y ZK de la misma persona (test que
    documenta el doble voto).
  - Cada vía sigue rechazando su nullifier repetido.
  - Una vía fuera del enum se rechaza.
  - Los tests de una sola vía se mantienen.
- Web:
  - Por defecto, con las dos vías habilitadas, se crea `ambas`.
  - `ambas` exige las dos vías habilitadas.
  - Con `ambas`, la página ofrece las vías habilitadas.
  - E2E del formulario con tres opciones, con axe.
