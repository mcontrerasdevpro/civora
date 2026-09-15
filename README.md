# Voto Anonimo

Prueba de concepto de un sistema de voto anonimo y verificable, pensada para
presentar a organismos y ciudadania: demostrar que es posible construir un
mecanismo de voto fiable, resistente al fraude y con la identidad del
votante certificada sin quedar nunca vinculada a su voto.

## La idea en una frase

El votante se identifica con su DNIe o certificado digital, el sistema
comprueba que cumple los requisitos legales, y genera una prueba
criptografica de elegibilidad que no revela quien es. Esa prueba es lo
unico que llega al voto.

## Requisitos para votar

- Estar empadronado en cualquier municipio de Espana.
- Ser titular de un DNI espanol.
- Residencia continuada en Espana de al menos 5 anios.
- Tener 18 anios cumplidos.

## Que hay montado ahora mismo

| Componente | Ubicacion | Estado |
|---|---|---|
| Landing / web | apps/web | Pagina de inicio terminada; /votar, /resultados, /verificar son esqueletos |
| Tipos compartidos | packages/shared-types | Esquema de propuesta, voto y resultados (Zod) |
| Identidad ZK | packages/zk-identity | Interfaz propia sobre ZKPassport, integracion real pendiente |
| Contratos | packages/contracts | VotacionAnonima.sol - voto por nullifier, sin doble voto, verificacion ZK pendiente |
| Documentacion | docs/ | Especificacion publica y modelo de amenazas |

Ver docs/especificacion-publica.md para el detalle de cada componente y
docs/modelo-amenazas.md para que garantiza el sistema y que queda
todavia por resolver.

## Arrancar en local o Codespaces

Este repo esta preparado para abrirse directamente en GitHub Codespaces
(.devcontainer ya configurado) o en local con pnpm:

pnpm install
pnpm dev

La web queda disponible en http://localhost:3000

## Estructura

voto-anonimo/
  apps/web         -> Next.js: landing, formulario, resultados, verificador
  packages/contracts    -> Contrato de votacion (Solidity)
  packages/zk-identity   -> Capa de identidad ZK (agnostica de proveedor)
  packages/shared-types  -> Esquema compartido de propuesta/voto/resultados
  docs/            -> Especificacion publica y modelo de amenazas

## Por que estas decisiones

- Monorepo: la web, los contratos y la logica de identidad comparten un
  unico esquema de datos (shared-types), evitando que diverjan.
- Identidad en capa aislada: zk-identity expone una interfaz propia en vez
  de acoplar la app directamente al SDK de ZKPassport, para poder migrar
  en el futuro a la Cartera Europea de Identidad Digital (eIDAS 2.0) sin
  tocar el resto del sistema.
- Voto por nullifier: cada prueba de elegibilidad genera un identificador
  unico que impide votar dos veces sin revelar quien voto.

## Aviso legal

Esta es una prueba de concepto tecnica, no un sistema habilitado para
elecciones oficiales vinculantes en Espana.
