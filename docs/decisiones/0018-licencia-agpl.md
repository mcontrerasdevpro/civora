# 0018. Licencia AGPL-3.0-or-later

- **Estado:** aceptada
- **Fecha:** 2026-10-07
- **Relacionada:** [ADR 0017](0017-servicios-por-frontera-de-confianza.md#licencia)

## Contexto

El repositorio es público en GitHub, pero hasta ahora no tenía archivo
`LICENSE` ni campo `license` en ningún `package.json`. Sin licencia, nadie
puede usar, copiar ni modificar legalmente el código, aunque lo pueda leer.
`VotacionAnonima.sol` y `MockRootVerifier.sol` declaraban
`GPL-3.0-only`.

Para un sistema de voto, la confianza depende de que cualquiera pueda
auditar el código que se ejecuta, también el que corre en el servidor.
Además, el estudio de [spain-in-parallel](https://github.com/spain-in-parallel)
(ADR 0016 y 0017) muestra código reutilizable en AGPL-3.0 (`gateway`) y en
GPL-3.0 (el resto).

## Decisión

- **Todo el código propio de Civora se publica bajo
  AGPL-3.0-or-later.**
  - [`LICENSE`](../../LICENSE) en la raíz, con el texto oficial de la
    [FSF](https://www.gnu.org/licenses/agpl-3.0.txt).
  - `"license": "AGPL-3.0-or-later"` en los cinco `package.json`.
  - `SPDX-License-Identifier: AGPL-3.0-or-later` en los contratos propios
    (`VotacionAnonima.sol` y `MockRootVerifier.sol`).
- **Cuándo se aplica al contrato:** el cambio de cabecera en
  `VotacionAnonima.sol` es efectivo en el **próximo despliegue**.
  - Los contratos ya desplegados en Sepolia se compilaron con la
    cabecera `GPL-3.0-only` y siguen bajo esa licencia en su commit de
    despliegue.
  - El comentario forma parte de los metadatos de `solc`, así que el
    bytecode nuevo solo difiere en el *hash* de metadatos. La verificación
    byte a byte
    ([ROADMAP](../ROADMAP.md#verificación-pública-del-bytecode)) debe usar
    el commit con el que se desplegó cada contrato.
- **Licencias comerciales aparte:** el titular de los derechos puede
  ofrecer el código de Civora bajo otras condiciones (licencia comercial)
  a quien no pueda o no quiera cumplir la AGPL, por ejemplo una
  administración que necesite modificarlo sin publicar los cambios. La
  AGPL sigue disponible para todos.
- **Contribuciones externas: acuerdo de cesión (CLA).** Para poder ofrecer
  licencias comerciales, el titular necesita tener los derechos de todo el
  código.
  - Antes de aceptar contribuciones de terceros, cada contribuyente debe
    firmar un acuerdo de cesión o de licencia amplia con derecho a
    sublicenciar.
  - El texto lo revisa un abogado y se publica en un `CONTRIBUTING.md`
    ([ROADMAP](../ROADMAP.md#paso-a-producción)).
  - Hasta entonces no se aceptan PR externas.

### Componentes de terceros

No cambian de licencia:

| Componente | Licencia | Motivo |
|---|---|---|
| `packages/contracts/contracts/zkpassport/IRootVerifier.sol` y `Types.sol` | Apache-2.0 | Interfaces de ZKPassport; la combinación con AGPL es válida |
| `apps/web/public/js/autoscript.js` (Autofirma 1.10.1) | La del proyecto [clienteafirma](https://github.com/ctt-gob-es/clienteafirma), licencia dual GPL-2.0-or-later y EUPL-1.1; confirmar en su repositorio | Se sirve tal cual, sin modificar |
| `apps/web/lib/certificados-raiz/` | Certificados públicos de la FNMT y la DGP | Datos de confianza, no código |

### Dependencias

`pnpm licenses list --prod` (2026-10-07):

- **Compatibles con la AGPL:** la gran mayoría es permisiva: MIT (100),
  Apache-2.0 (13), ISC (12), BSD-3-Clause (5), 0BSD y `pako`
  (MIT y Zlib).
- **`caniuse-lite`:** CC-BY-4.0. Son datos, no código, y también es
  compatible.
- **`@img/sharp-*`:** Apache-2.0 y LGPL-3.0-or-later por `libvips`. Es
  compatible al enlazarse dinámicamente. Además, el optimizador de
  imágenes está desactivado.
- **`@zkpassport/utils`** (0.36.0, 0.37.5 y 0.39.0): **no declara
  licencia** en su `package.json`. `@zkpassport/sdk` es Apache-2.0. Hay
  que confirmar la licencia de `utils` con ZKPassport antes de producción
  y antes de ofrecer cualquier licencia comercial. Sin licencia declarada,
  su uso depende de la que tenga su repositorio de origen.

## Consecuencias

- **Código de terceros con copyleft:** se puede reutilizar código GPL-3.0
  o AGPL-3.0 de terceros (por ejemplo, del `gateway`), pero **ese código
  no puede entrar en una licencia comercial** sin permiso de sus autores.
  - Si se quiere mantener abierta la vía comercial, lo prudente es lo que
    proponen los ADR 0016 y 0017: diseños inspirados, sin copiar código.
  - Si alguna vez se copia, se marca con su cabecera y autoría y se anota
    en esta tabla.
- **AGPL, sección 13:** quien ofrezca una versión modificada de Civora a
  usuarios por red debe darles acceso a su código fuente.
  - El titular no está obligado frente a sí mismo, pero la web enlazará al
    código fuente del commit desplegado, para predicar con el ejemplo y
    facilitar la auditoría
    ([ROADMAP](../ROADMAP.md#paso-a-producción)).
- **Contratos:** quien vea un contrato desplegado en un explorador ve la
  licencia de su cabecera. Los contratos de Sepolia actuales seguirán
  mostrando `GPL-3.0-only` hasta que se redespliegue.

## Alternativas

- **GPL-3.0-only** (lo que declaraba el contrato): no obliga a publicar
  las modificaciones de un servicio en red y no permite reutilizar código
  del `gateway`.
- **Licencia permisiva (MIT o Apache-2.0):** facilita la adopción, pero
  permite versiones cerradas de un sistema de voto y no admite código
  GPL de terceros.
- **Sin licencia** (estado anterior): el código público no se puede usar
  legalmente.
