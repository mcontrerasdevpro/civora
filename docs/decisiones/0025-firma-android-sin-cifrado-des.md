# 0025. En Android, Cliente @firma devuelve la firma sin cifrado DES

- **Estado:** aceptada (2026-11-19); pendiente de probar con un móvil real
- **Fecha:** 2026-11-19
- **Modifica:** [ADR 0024](0024-servidor-intermedio-autofirma-movil.md) (solo en Android)

## Contexto

Con el servidor intermedio de [ADR 0024](0024-servidor-intermedio-autofirma-movil.md)
desplegado, la firma desde Android (Android 16, Cliente @firma 1.9.3, la
última publicada en Google Play) fallaba con «Error al cifrar la firma para
enviarla al servidor intermedio». La app firma bien, pero al cifrar el
resultado para subirlo usa DES (`CipherDataManager`, `DES/ECB/NoPadding`, con
la clave del parámetro `key`) y ese paso lanza una excepción en el móvil.
La versión en desarrollo (1.10.1) cifra con AES, pero no está publicada.

## Decisión

Parchear `public/js/autoscript.js` (marcado `CIVORA (ADR 0025)`) para que en
Android no envíe `key` ni `cipher`. Sin clave, la app 1.9.x sube el
certificado y la firma en Base64 sin cifrar al servidor intermedio, y el
navegador los recoge sin descifrar. En iOS y en escritorio no cambia nada.

## Por qué es aceptable

- El certificado y la firma llegan a la API de Civora de todos modos para
  verificarse; el cifrado del servidor intermedio solo los protegía del
  propio servidor intermedio, que es Civora.
- El transporte va por HTTPS y el dato se borra al entregarse o a los
  5 minutos.
- Para recogerlo hace falta el identificador de sesión (20 caracteres
  aleatorios), que solo conocen el navegador y la app.

## Consecuencias

- Durante como mucho 5 minutos, la tabla `servidor_intermedio` guarda en
  claro el certificado (con NIF y nombre) y la firma de quien vota desde
  Android. No se registran en logs.
- Hay que mantener el parche al actualizar `autoscript.js`. Cuando Cliente
  @firma con AES esté publicada, se puede retirar y volver al cifrado.
