# 0021. Una sola vía de identidad por votación y alertas de fraude

- **Estado:** aceptada (paso 1 implementado; paso 2, en el contrato, pendiente)
- **Fecha:** 2026-10-09
- **Relacionada:** [ADR 0005](0005-no-publicar-nif.md) (nullifier de certificado), [ADR 0014](0014-opcion-vinculada-prueba-zk.md) (vía ZK), hallazgo [A-04](../auditoria-seguridad.md#a-04--alto--una-misma-persona-puede-usar-vías-con-espacios-de-nullifier-distintos)

## Contexto

El 2026-10-09 se votó dos veces en producción en la misma propuesta: una vez
con ZKPassport y otra con certificado digital. El contrato aceptó los dos
votos, como permite su diseño:

- Solo rechaza un **nullifier** repetido, y cada vía calcula el suyo:
  - **Certificado:** `HMAC(secreto, propuesta:certificado:DNI)` (ADR 0005).
  - **ZKPassport:** el identificador único de la prueba.
- Nada en la cadena relaciona los dos nullifiers de una misma persona.
- Según la documentación de ZKPassport, su identificador único es **por
  documento**, no por persona. Quien tenga DNIe y pasaporte obtiene dos
  identificadores, y puede votar dos veces incluso solo con ZKPassport.
- ZKPassport no puede revelar nada que coincida con el certificado: su
  «número de documento» es el número de soporte del DNIe o el del
  pasaporte, no el NIF.
- `votarConPruebaZk` no tiene restricción de remitente: cualquiera puede
  llamar al contrato directamente con una prueba, sin pasar por la web.

Los tests `voto cruzado (A-04)` de `packages/contracts` reproducen los dos
casos: certificado más ZK, y DNIe más pasaporte.

## Decisión

**Cada votación admite una sola vía de identidad. Por defecto, solo la de
certificado.** Es la única que da un nullifier por persona: el DNIe y el
certificado de la FNMT llevan el mismo NIF, así que dan el mismo nullifier.

### Paso 1: en la web, sin redesplegar el contrato

- **`VIAS_HABILITADAS`:** `certificado` (por defecto), `zk` o
  `certificado,zk`. Un valor desconocido no abre ninguna vía: se vuelve al
  valor por defecto (`lib/vias-voto.mjs`).
  - `/api/propuestas/<id>` devuelve `viasPermitidas`, y la página de voto
    solo ofrece esas. Si el servidor no las envía, solo ofrece certificado.
  - Las rutas de voto rechazan con 403 la vía no permitida.
- **Alertas de fraude** (`lib/alertas-fraude.mjs` y
  `lib/intentos-repetidos.ts`):
  - Cada intento rechazado se apunta en `civora-db` (tabla
    `intentos_repetidos`) por propuesta, seudónimo y motivo:
    `voto-repetido` o `via-no-permitida`.
  - **Seudónimo:** en la vía de certificado, un HMAC del nullifier con una
    clave derivada de `NULLIFIER_CERTIFICADO_SECRET`. Es distinto del
    nullifier publicado, así que la alerta no permite buscar el voto ni su
    opción. En la vía ZK, el servidor no ve el identificador si el contrato
    rechaza el voto, así que los intentos se agregan por propuesta.
  - Al llegar a `ALERTA_FRAUDE_UMBRAL` intentos (3; mínimo 2) dentro de
    `ALERTA_FRAUDE_VENTANA_HORAS` (24), pasa esto:
    - Se registra un aviso de texto fijo.
    - Si está definida, se envía **una sola** alerta por ventana a
      `ALERTA_FRAUDE_WEBHOOK_URL` (solo `https`, con
      `ALERTA_FRAUDE_WEBHOOK_TOKEN` opcional como `Bearer`). Es atómico en
      Postgres, aunque haya varias instancias.
    - Mientras dure la ventana, esa persona recibe un 429 antes de llegar
      al contrato.
  - La alerta solo lleva la propuesta, la vía, el motivo, los intentos, la
    ventana y el seudónimo. Nunca incluye la opción, el NIF, el nullifier ni
    la IP.
  - Un fallo de la base de datos o del webhook no cambia la respuesta del
    voto: solo se registra con `registrarError`.

### Paso 2: en el contrato (pendiente, en el ROADMAP)

- La vía permitida se guarda en cada propuesta al crearla y no se puede
  cambiar. `votarManual` y `votarConPruebaZk` rechazan la vía que no
  corresponde. Así se cierra también la llamada directa al contrato.
- Exige redesplegar. Las propuestas actuales quedan archivadas.

## Alternativas

- **Deduplicar por nombre y fecha de nacimiento**, revelados por ZKPassport
  y comparados con el certificado: descartada.
  - El certificado no lleva la fecha de nacimiento.
  - Los nombres se repiten, así que habría falsos positivos que impedirían
    votar a personas distintas.
  - Revelaría al servidor la identidad del votante ZK.
- **Pedir el certificado también en la vía ZK:** descartada. Anula la razón
  de ser de la vía ZK, que la web no conozca la identidad.
- **Mantener las dos vías y solo alertar:** descartada. La alerta no impide
  el segundo voto, porque los dos nullifiers son distintos y válidos, y el
  servidor no puede saber que son de la misma persona.
- **Censo con un único canal por persona (Fase 1):** es la solución
  completa, pero exige el censo congelado y Semaphore. Esta decisión es la
  medida hasta entonces.

## Consecuencias

- **Con una sola vía, no hay voto cruzado entre vías por la web.**
  - Con `certificado`, una persona solo puede votar una vez: el mismo NIF da
    el mismo nullifier en el DNIe y en la FNMT.
  - Con `zk`, quien tenga DNIe y pasaporte sigue pudiendo votar dos veces.
    Por eso no es el valor por defecto.
- **Hasta el paso 2**, quien llame directamente a `votarConPruebaZk` con una
  prueba válida puede votar por ZK aunque la web no lo ofrezca. En la demo
  de Sepolia solo valen pasaportes simulados (ADR 0010).
- La vía de certificado no oculta la identidad al servidor (README, garantía
  «Anonimato por vía»). El voto único se gana a costa de anonimato frente al
  operador hasta la Fase 1.
- Los votos ya emitidos no se pueden deshacer: la propuesta del 2026-10-09
  mantiene sus dos votos.

## Verificación

- Contrato: 3 tests del voto cruzado (certificado + ZK, DNIe + pasaporte, y
  el mismo NIF rechazado).
- Web: `test/voto-unico.test.mjs` (vías, seudónimo, configuración, umbral,
  campos de la alerta y uso en las rutas).
- E2E: `e2e/voto-unico.spec.ts` (una tarjeta por vía, servidor sin vías,
  bloqueo 429 y axe) a 1280 y 375 px.
- SQL de `intentos_repetidos` comprobado en Postgres (PGlite):
  - El contador avanza por persona y motivo.
  - Una sola alerta por ventana.
  - El bloqueo empieza al llegar al umbral.
  - Todo se reinicia fuera de la ventana.
  - Con dos marcas simultáneas, solo una alerta.
