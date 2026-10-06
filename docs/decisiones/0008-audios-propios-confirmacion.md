# 0008. Audios propios para confirmar la opción, no speechSynthesis

- **Estado:** aceptada
- **Fecha:** 2026-10-06

## Contexto

El modo sencillo lee las pantallas en voz alta. `speechSynthesis` usa voces
del sistema, pero algunas funcionan en red: las voces «Google» de Chrome
(`localService === false`) envían el texto a servidores externos. Leer «Va a
votar: En contra» con ellas filtraría el voto.

## Decisión

- La confirmación de la opción elegida se reproduce con un audio pregrabado
  por cada opción del enum, servido desde nuestro origen
  (`apps/web/public/audio/confirmacion`, permitido por `media-src 'self'`).
  Nunca pasa por `speechSynthesis`.
- En el resto de pantallas, «Escuchar» usa solo voces con `localService`;
  si no hay ninguna, el botón se oculta con un aviso.
- El reconocimiento de voz de la Web Speech API no se usa nunca para elegir
  la opción: en Chrome envía el audio a servidores externos.

## Alternativas

- **speechSynthesis con cualquier voz:** cómodo, pero puede enviar el voto
  a terceros.
- **Síntesis en nuestro servidor:** el servidor recibiría la opción en
  claro.

## Consecuencias

- Los audios actuales son provisionales (voz local Helena es-ES); en
  producción se sustituyen por grabaciones profesionales
  ([ROADMAP](../ROADMAP.md#accesibilidad-y-voto-asistido-web)).
- Cada idioma nuevo necesita sus propios audios.
- Un E2E comprueba que la confirmación no llama a `speechSynthesis`.
