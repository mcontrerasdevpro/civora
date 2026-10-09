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
| [0014](0014-opcion-vinculada-prueba-zk.md) | La opción va vinculada a la prueba ZK | aceptada |
| [0015](0015-condiciones-voto-organismos-publicos.md) | Condiciones para votar y contraste con organismos públicos | aceptada (conexiones pendientes de convenio) |
| [0016](0016-propuestas-registro-ideas-multifirma-ipfs.md) | Propuestas con registro de ideas, multifirma e IPFS | aceptada (diseño; sin implementar) |
| [0017](0017-servicios-por-frontera-de-confianza.md) | Separación en servicios por frontera de confianza, en monorepo | aceptada (diseño; sin implementar) |
| [0018](0018-licencia-agpl.md) | Licencia AGPL-3.0-or-later | aceptada |
| [0019](0019-ia-punto-asistido-auditoria.md) | IA, punto asistido y auditoría | aceptada (diseño; sin implementar) |
| [0020](0020-indice-incremental-eventos.md) | Índice incremental de eventos en civora-db | aceptada |
| [0021](0021-una-sola-via-y-alertas-de-fraude.md) | Una sola vía de identidad por votación y alertas de fraude | aceptada (paso 2, en el contrato, pendiente) |
| [0022](0022-el-votante-elige-la-via.md) | El votante puede elegir la vía (riesgo de doble voto aceptado en la demo) | aceptada (temporal) |

Para añadir una: copia cualquier ADR, usa el siguiente número libre y
añádelo a esta tabla.
