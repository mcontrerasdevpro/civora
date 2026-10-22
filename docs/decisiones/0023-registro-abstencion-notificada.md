# 0023. Registro interno de abstención notificada

- **Estado:** aceptada para la PoC; no válida como mecanismo electoral oficial
- **Fecha:** 2026-10-22

## Contexto

El [OpTE](https://www.observatoriotransparenciaelectoral.org/abstencion) describe un proceso de declaración responsable firmada, remitida a su organización y acompañada de observación electoral. Civora no es autoridad electoral, no tiene acceso al censo ni puede controlar votos presenciales o por correo. Tampoco puede asociar de forma segura una prueba ZK con la identidad de un certificado. Un registro local no puede presentarse como equivalente ni impedir que terceros utilicen indebidamente datos electorales.

## Decisión

Civora permite, durante una propuesta abierta, registrar una declaración de intención de abstenerse, autenticada mediante firma de un certificado admitido por el flujo actual. La pantalla describe la declaración y requiere confirmación expresa. Se conserva un recibo consultable con identificador, fecha y huella del contenido. La API verifica la firma y el backend no conserva NIF, certificado ni firma; la identidad se representa en la tabla por el HMAC ya empleado para el voto con certificado.

Para esa propuesta y ese pseudónimo, la aplicación serializa con un bloqueo transaccional el registro de abstención y el envío de un voto certificado. Un voto previo impide una abstención retroactiva; una abstención previa impide votar después con certificado. El registro nunca emite una opción `abstencion`, no modifica el contrato ni sus resultados, y no cambia otros canales.

## Límites obligatorios

- El registro **no es oficial**, no está firmado o validado por OpTE, junta electoral ni autoridad pública, y no sustituye declaración, envío, observación ni trámites descritos por OpTE.
- No verifica inscripción censal ni elegibilidad electoral. No bloquea voto presencial, por correo, fuera de Civora ni por ZKPassport; no puede asegurar que no se cuente otro voto.
- El identificador y la huella son recibos de una base de datos administrada por Civora, no una prueba pública criptográfica ni un anclaje en cadena. La firma se valida al registrar, pero se descarta, por lo que la consulta pública no permite revalidarla independientemente.
- El nullifier HMAC y la base de datos siguen bajo control del operador; se aplican las limitaciones de [ADR 0005](0005-no-publicar-nif.md).

## Alternativas

- No ofrecer registro: evita que se confunda con una salvaguarda electoral, pero no cubre la solicitud de declarar intención en Civora.
- Añadir un voto «abstención»: descartado; una opción de abstención en el escrutinio es un voto y no es una declaración de no participar.
- Publicar un registro en cadena o afirmar que impide voto por correo/presencial: descartado por falta de autoridad, censo, prueba de abstención externa y asociación de identidad fiable.

## Consecuencias

Se añade una ruta independiente de la papeleta, una tabla Postgres y consulta pública limitada al recibo. No se toca el contrato ni se cambia el recuento. Antes de cualquier uso oficial se requiere diseño y aprobación legal/institucional, integración con el proceso electoral y auditorías independientes; el software actual sigue siendo una PoC.
