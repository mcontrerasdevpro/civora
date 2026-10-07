# Decisiones de arquitectura (ADR)

Cada decisión vive en un archivo con contexto, decisión, alternativas y
consecuencias. Para cambiar una decisión, crea un ADR nuevo que la
sustituya y marca la anterior como «sustituida por NNNN».

| Nº | Decisión | Estado |
|---|---|---|
| [0001](0001-monorepo.md) | Monorepo con esquema compartido | aceptada |
| [0002](0002-capa-identidad-aislada.md) | Capa de identidad aislada | aceptada |
| [0003](0003-zkpassport-verificacion-on-chain.md) | ZKPassport con verificación dentro del contrato | aceptada |
| [0004](0004-relayer-inmutable.md) | Relayer inmutable | aceptada |
| [0005](0005-no-publicar-nif.md) | Nunca publicar el NIF ni hashes directos del DNI | aceptada |
| [0006](0006-eliminacion-via-manual.md) | Eliminación de la vía de voto manual | aceptada |
| [0007](0007-csp-con-nonce.md) | CSP con nonce y CSP de desarrollo | aceptada |
| [0008](0008-audios-propios-confirmacion.md) | Audios propios para confirmar la opción, no speechSynthesis | aceptada |
| [0009](0009-limites-asistente-ia.md) | Límites del asistente de IA | aceptada (no implementado) |
| [0010](0010-demo-publica-testnet.md) | Demo pública en Sepolia con opt-in explícito | aceptada |
| [0011](0011-alojamiento-vps-propio.md) | Alojamiento en VPS propio con Easypanel | aceptada |
| [0012](0012-next-15-react-19.md) | Next 15.5 y React 19.2 | aceptada |
| [0013](0013-postgres-en-el-vps.md) | Postgres de la demo en el VPS | aceptada |
| [0015](0015-condiciones-voto-organismos-publicos.md) | Condiciones para votar y contraste con organismos públicos | aceptada (conexiones pendientes de convenio) |

Para añadir una: copia cualquier ADR, usa el siguiente número libre y
añádelo a esta tabla.
