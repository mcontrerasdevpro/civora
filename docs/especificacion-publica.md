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

Estos requisitos son fijos para toda la instancia (no se configuran por
propuesta). Ver `docs/modelo-amenazas.md` para qué parte de cada requisito
se comprueba realmente hoy y cuál queda pendiente.

## Componentes

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| Web | `apps/web` | Landing, listado y creación de propuestas, flujo de voto, panel de resultados, verificador de recibo |
| Identidad ZK | `packages/zk-identity` | Genera la solicitud de prueba ZKPassport (DNIe/pasaporte) sin exponer el SDK al resto del monorepo |
| Identidad por certificado | `apps/web/lib/certificado-digital.ts` | Verifica firmas Autofirma (FNMT/DNIe): firma, cadena de confianza y revocación OCSP |
| Tipos compartidos | `packages/shared-types` | Esquema de propuesta, voto y resultados (Zod) |
| Contratos | `packages/contracts` | Registro de propuestas (con apertura/cierre) y votos por nullifier; verificación on-chain de la prueba ZKPassport |
| Base de datos | Postgres (en el VPS de la demo) | Contenido de cada propuesta (título, pregunta, fechas); el contrato ancla el hash de ese contenido |

## Cómo se identifica el votante

El votante elige una de tres vías al emitir su voto:

1. **DNIe o pasaporte (NFC), vía ZKPassport.** El móvil genera una prueba
   de conocimiento cero de que el documento certifica mayoría de edad y
   nacionalidad española, sin revelar el documento. La prueba se verifica
   dentro del propio contrato (`VotacionAnonima.votarConPruebaZk`), contra
   el verificador oficial de ZKPassport: ni este servidor ni quien lo
   opera pueden aceptar un voto por esta vía sin una prueba
   criptográfica válida.
2. **Certificado digital, vía Autofirma.** El navegador firma un código
   aleatorio con el certificado instalado (FNMT, DNIe...); el servidor
   verifica la firma, que el certificado encadena hasta una autoridad real
   (FNMT-RCM o la Dirección General de la Policía) y que no está revocado
   (OCSP). Esta vía prueba identidad con fuerza real, pero no mayoría de
   edad: un certificado no lleva la fecha de nacimiento.
3. **Datos manuales**, de respaldo cuando no se dispone de las anteriores:
   solo valida el formato del DNI (letra de control) y la edad declarada,
   sin contrastar con ningún registro oficial.

Cualquiera de las tres vías produce un `nullifier`: un identificador único
por propuesta que impide votar dos veces sin revelar quién votó.

## Ciclo de vida de una propuesta

1. **Creación** (`/propuestas/nueva`, protegido por una clave de
   administrador): se ancla el hash del contenido en el contrato y se
   guarda el contenido en la base de datos, con una fecha de apertura y
   una de cierre.
2. **Votación**: abierta entre esas dos fechas; el contrato rechaza
   cualquier voto fuera de ese rango.
3. **Resultados**: públicos y en vivo desde el contrato en todo momento,
   antes y después del cierre (`/resultados/[id]`).
4. **Verificación del recibo**: con el nullifier que recibe al votar,
   cualquiera puede comprobar en `/verificar` que su voto quedó contado y
   cómo, sin revelar su identidad.

## Referencias de diseño

- Modelo de propuesta inspirado en el esquema `idea/v1` del proyecto
  `council-dao` (spain-in-parallel), adaptado con los requisitos de
  empadronamiento y residencia propios de este proyecto.
- Verificación de identidad basada en pruebas de conocimiento cero sobre el
  chip NFC del DNIe/pasaporte, vía el SDK y el verificador on-chain de
  [ZKPassport](https://zkpassport.id).
- Verificación de certificado digital vía
  [Autofirma / Cliente @firma](https://github.com/ctt-gob-es/clienteafirma),
  la herramienta oficial del Gobierno de España.

Ver `docs/modelo-amenazas.md` para el detalle de qué ataques previene el
sistema y qué queda pendiente.
