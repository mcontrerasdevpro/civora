# 0014. La opción va vinculada a la prueba ZK

- **Estado:** aceptada
- **Fecha:** 2026-10-07
- **Complementa:** [ADR 0003](0003-zkpassport-verificacion-on-chain.md)

## Contexto

`votarConPruebaZk` recibía la prueba ZKPassport y la opción por separado.
La prueba acreditaba la elegibilidad para la propuesta, pero no la opción.
Quien viera la transacción antes de que se minara (el relayer, que la
construye, o un observador de la mempool) podía reenviar la misma prueba con
otra opción y el contrato aceptaba la primera que llegara (hallazgo R-01,
crítico). La vía de certificado ya firmaba la opción (R-04).

ZKPassport permite vincular datos a la prueba: `bind("custom_data", …)` en
el SDK (hasta 500 bytes) y `getBoundData(committedInputs)` en el helper del
verificador, que devuelve ese dato tal como lo comprometió la prueba.

## Decisión

- La solicitud a ZKPassport vincula
  `custom_data = "civora-voto:<propuestaId>:<opción>"`, con la opción en su
  forma canónica (`a_favor`, `en_contra`, `abstencion`). El formato vive en
  `datosVinculadosDeVoto` (`packages/shared-types`) y en
  `VotacionAnonima.datosVinculados`; un test comprueba que coinciden.
- `votarConPruebaZk` lee `getBoundData(params.committedInputs).customData` y
  revierte con `OpcionNoVinculada` si no es exactamente el dato de la
  propuesta y la opción recibidas. La prueba sin dato vinculado no sirve.
- El ámbito (`scope`) no cambia: sigue siendo uno por propuesta, así que el
  nullifier sigue siendo uno por persona y propuesta, sea cual sea la opción.
- En la vía ZK el QR se muestra al confirmar el voto, ya elegida la opción,
  igual que la firma de Autofirma en la vía de certificado.

## Alternativas

- **Opción dentro del ámbito o del subámbito:** el nullifier dependería de
  la opción y la misma persona podría votar una vez por opción.
- **Firma aparte del votante sobre la opción:** exigiría una clave del
  votante que la vía ZK no tiene; la app ya firma lo vinculado.
- **Enviar la transacción por un canal privado sin mempool pública:** no
  protege del relayer, que ve la prueba.

## Consecuencias

- Una prueba solo vale para la opción con la que se generó: el relayer o un
  observador ya no pueden cambiarla. Pueden reenviarla con la misma opción,
  lo que no altera el voto.
- Cambiar de opción en la confirmación exige generar otra prueba con la app.
- **Contrato nuevo:** hay que desplegarlo en Sepolia y actualizar
  `CONTRATO_DIRECCION` antes de fusionar a `main`. Las propuestas y votos del
  contrato anterior dejan de verse en la web.
- El dato vinculado incluye la opción en claro dentro de la prueba, igual
  que la opción ya es pública en el evento `VotoEmitido`: no reduce el
  anonimato actual.
