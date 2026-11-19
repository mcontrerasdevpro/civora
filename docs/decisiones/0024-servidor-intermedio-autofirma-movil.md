# 0024. Servidor intermedio de Autofirma para firmar desde el móvil

- **Estado:** aceptada (2026-11-19); pendiente de probar con la app en un móvil real
- **Fecha:** 2026-11-19
- **Relacionada:** [ADR 0013](0013-postgres-en-el-vps.md) (Postgres en el VPS), [ADR 0017](0017-servicios-por-frontera-de-confianza.md)

## Contexto

En Android e iOS la vía de certificado mostraba «Esta aplicación no permite
firmar desde el navegador en dispositivos móviles». Civora no lo bloqueaba a
propósito: `public/js/autoscript.js` (1.10.1) no habla en el móvil con
Autofirma de escritorio, sino con la app **Cliente @firma móvil**, y lo hace
a través de un *servidor intermedio* del mismo origen:

- `/afirma-signature-storage/StorageService` guarda datos (`op=put`).
- `/afirma-signature-retriever/RetrieveService` los devuelve (`op=get`);
  mientras no existen responde `ERR-06` y el script sigue esperando.

Al cargar, el script comprueba los dos con `op=check`. Como Civora no los
tenía, recibía un 404 y marcaba el trámite como incompatible.

El flujo es: el navegador genera una clave AES-256 (o DES en navegadores
antiguos), abre `afirma://sign?…` con la clave en el enlace y, si los datos
no caben en la URL, los sube cifrados al almacén. La app firma con el
certificado del móvil, sube el resultado cifrado al almacén con el
identificador de sesión y el navegador lo recoge. El servidor nunca ve la
clave.

## Decisión

Implementar los dos servicios como rutas de la propia web Next.js, con los
datos en una tabla `servidor_intermedio` de Postgres:

- Cada dato caduca a los 5 minutos y se borra en la misma operación que lo
  entrega (`DELETE … RETURNING`): solo se puede recoger una vez.
- Identificadores alfanuméricos de 8 a 64 caracteres, datos de hasta
  256 KB y como mucho 2000 datos pendientes a la vez, para que no sirva de
  almacén ajeno.
- Respuestas en texto plano y siempre con estado 200, como los servlets
  originales, porque el script solo lee el texto con 200.
- No se registran identificadores ni datos; los errores solo con
  `lib/registro.mjs`.
- La verificación de la firma no cambia: la recibe la misma API, con la
  misma comprobación CAdES, cadena FNMT o DGP y OCSP.

Lo eligió el responsable el 2026-11-19 frente a las alternativas.

## Alternativas

- **Rutas en memoria:** más simples, pero una firma en curso se pierde si el
  contenedor se reinicia y no funciona con más de una instancia.
- **Servidores oficiales Java (`afirma-signature-storage` y
  `afirma-signature-retriever`) como otro servicio en Easypanel:**
  compatibilidad garantizada, pero añaden una imagen Java que mantener y
  enrutar por rutas en el mismo dominio.

## Consecuencias

- La vía de certificado funciona en Android (certificados del sistema o DNIe
  por NFC) e iOS (certificado importado antes en la app Cliente @firma).
- Dos rutas públicas nuevas sin autenticación, como en el servicio
  original. Un tercero puede guardar datos durante 5 minutos dentro de los
  topes, pero no leer los de otra sesión sin su identificador aleatorio de
  20 caracteres, y aunque lo tuviera no podría descifrarlos.
- Llenar el tope de pendientes impediría temporalmente firmar desde el
  móvil (`ERR-07`); no afecta al escritorio.
- Cuando se extraiga el servicio de identidad ([ADR 0017](0017-servicios-por-frontera-de-confianza.md)),
  estas rutas pueden quedarse en la web: no tienen secretos.
- **Pendiente:** comprobar con la app en un móvil real que acepta los
  parámetros de Civora (`SHA256withRSA`, `CAdES`, `mode=explicit`).
