# CÍVORA

Infraestructura de votación verificable — prueba de concepto pensada para
presentar a organismos y ciudadanía: demostrar que es posible construir un
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
| Landing / web | apps/web | Landing, /votar, /resultados y /verificar funcionan de extremo a extremo contra el contrato en un nodo Hardhat local |
| Tipos compartidos | packages/shared-types | Esquema de propuesta, voto y resultados (Zod) |
| Identidad ZK | packages/zk-identity | Interfaz propia sobre ZKPassport, integracion real pendiente; /votar deriva un nullifier localmente en el navegador a modo de demo |
| Contratos | packages/contracts | VotacionAnonima.sol - voto por nullifier, sin doble voto, recuento y recibo por nullifier; verificacion ZK on-chain pendiente |
| Documentacion | docs/ | Especificacion publica y modelo de amenazas |

Ver docs/especificacion-publica.md para el detalle de cada componente y
docs/modelo-amenazas.md para que garantiza el sistema y que queda
todavia por resolver.

## Arrancar en local o Codespaces

Este repo esta preparado para abrirse directamente en GitHub Codespaces
(.devcontainer ya configurado) o en local con pnpm:

pnpm install

El contrato necesita un nodo Ethereum local corriendo antes de arrancar la
web (en dos terminales):

pnpm --filter @civora/contracts node
pnpm --filter @civora/contracts deploy:localhost

El script de despliegue crea la propuesta de ejemplo y escribe la
direccion + ABI en apps/web/lib/generated/despliegue-localhost.json
(se regenera en cada despliegue, no se versiona). Con eso ya se puede
arrancar la web:

pnpm dev

La web queda disponible en http://localhost:3000. Si reinicias el nodo de
Hardhat, vuelve a ejecutar `deploy:localhost` (la direccion del contrato
cambia con cada nodo nuevo).

## Desplegar en Sepolia + Vercel

Para una demo publica (Vercel) el contrato no puede vivir en un nodo
Hardhat local: se despliega en la testnet Sepolia, gratuita (ver
docs/especificacion-publica.md).

1. Consigue una URL de RPC de Sepolia (Alchemy o Infura, plan gratuito) y
   una cuenta con ETH de Sepolia de un faucet.
2. En `packages/contracts/.env` (no se versiona):

   SEPOLIA_RPC_URL=...
   SEPOLIA_PRIVATE_KEY=...   # clave de la cuenta del paso anterior, sin 0x opcional

3. Despliega:

   pnpm --filter @civora/contracts deploy:sepolia

   El script imprime la direccion del contrato desplegado.
4. En Vercel (Settings -> Environment Variables del proyecto), define:

   CONTRATO_DIRECCION=<direccion impresa en el paso anterior>
   HARDHAT_RPC_URL=<la misma SEPOLIA_RPC_URL>
   HARDHAT_RELAYER_PRIVATE_KEY=<una clave con ETH de Sepolia; paga el gas de los votos>

   Sin CONTRATO_DIRECCION, apps/web/lib/contrato.ts asume que estas en
   local y busca el despliegue de Hardhat.

## Estructura

civora/
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
