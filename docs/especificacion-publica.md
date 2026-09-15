# Especificación pública

## Objetivo

Prueba de concepto de un sistema de voto anónimo y verificable, para
demostrar a organismos y ciudadanía que es posible construir un mecanismo
de voto fiable y resistente al fraude, como paso previo a estudiar su
implantación real.

## Requisitos de elegibilidad

- Empadronado en cualquier municipio de España.
- DNI español.
- Residencia continuada en España de al menos 5 años.
- Mayoría de edad (18 años).

## Componentes

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| Identidad ZK | `packages/zk-identity` | Genera y verifica pruebas de elegibilidad sin revelar datos personales |
| Tipos compartidos | `packages/shared-types` | Esquema de propuesta, voto y resultados |
| Contratos | `packages/contracts` | Registro de votos, prevención de doble voto, recuento público |
| Web | `apps/web` | Formulario de voto, panel de resultados, verificador de recibo |

## Referencias de diseño

- Modelo de propuesta inspirado en el esquema `idea/v1` del proyecto
  `council-dao` (spain-in-parallel), adaptado con los requisitos de
  empadronamiento y residencia propios de este proyecto.
- Verificación de identidad basada en pruebas de conocimiento cero sobre el
  chip NFC del DNIe/pasaporte, vía ZKPassport.

Ver `docs/modelo-amenazas.md` para el detalle de qué ataques previene el
sistema y qué queda pendiente.
