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
| Landing / web | apps/web | /propuestas lista y crea propuestas, /votar/[id], /resultados/[id] y /verificar funcionan de extremo a extremo contra el contrato en un nodo Hardhat local |
| Tipos compartidos | packages/shared-types | Esquema de propuesta, voto y resultados (Zod) |
| Identidad | packages/zk-identity + apps/web/lib | /votar ofrece tres vias: DNIe/pasaporte por NFC (ZKPassport, prueba verificada dentro del contrato), certificado digital (Autofirma + FNMT/DNIe, firma verificada en el servidor) y datos manuales (solo valida formato de DNI y edad, sin contrastar con registros oficiales) |
| Contratos | packages/contracts | VotacionAnonima.sol - varias propuestas con apertura/cierre, voto por nullifier, sin doble voto, recuento y recibo por nullifier; la via DNIe verifica la prueba ZKPassport dentro del propio contrato, contra el RootVerifier oficial |
| Base de datos | Postgres (Neon) | Guarda el contenido de cada propuesta (titulo, pregunta, fechas); el contrato ancla el hash de ese contenido para integridad |
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

El script de despliegue escribe la direccion + ABI en
apps/web/lib/generated/despliegue-localhost.json (se regenera en cada
despliegue, no se versiona). Las propuestas ya no se crean aqui: se crean
desde la web en /propuestas/nueva, lo que requiere una base de datos (ver
siguiente seccion).

## Base de datos (Neon)

El contenido de cada propuesta (titulo, pregunta, fechas de apertura y
cierre) se guarda en Postgres; el contrato solo ancla el hash de ese
contenido para poder verificar su integridad. Cualquier Postgres vale, pero
esta pensado para [Neon](https://neon.tech) (capa gratuita, sin necesidad
de gestionar un servidor):

1. Crea una cuenta y un proyecto en Neon.
2. Copia la cadena de conexion "pooled" (la que trae `-pooler` en el host,
   pensada para entornos serverless como Vercel).
3. En `apps/web/.env.local` (no se versiona):

   DATABASE_URL=postgresql://usuario:contraseña@host-pooler.neon.tech/neondb?sslmode=require

La tabla `propuestas` se crea sola la primera vez que la web la necesita
(no hace falta ejecutar ninguna migracion a mano).

Con el nodo de Hardhat, el contrato desplegado y `DATABASE_URL` definida,
ya se puede arrancar la web:

pnpm dev

La web queda disponible en http://localhost:3000. Crea tu primera propuesta
en http://localhost:3000/propuestas/nueva. Si reinicias el nodo de
Hardhat, vuelve a ejecutar `deploy:localhost` (la direccion del contrato
cambia con cada nodo nuevo; las propuestas guardadas en Neon quedan
huerfanas hasta que las recrees).

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
   DATABASE_URL=<cadena de conexion "pooled" de tu proyecto Neon>
   ADMIN_SECRET=<clave para poder crear propuestas desde /propuestas/nueva>
   RETO_CERTIFICADO_SECRET=<clave para la via de certificado digital>

   Sin CONTRATO_DIRECCION, apps/web/lib/contrato.ts asume que estas en
   local y busca el despliegue de Hardhat.

## Identidad con ZKPassport (verificacion on-chain)

La via de DNIe/pasaporte genera una prueba en modo `compressed-evm` y la
envia, sin verificarla en ningun servidor, a
`VotacionAnonima.votarConPruebaZk`: el contrato la verifica el mismo,
llamando al **RootVerifier oficial de ZKPassport**
(`0x1D000001000EFD9a6371f4d90bB8920D5431c0D8`, mismo address en Ethereum,
Sepolia y Base) y comprobando edad minima, nacionalidad y que la prueba se
genero para esa propuesta concreta (ver `packages/contracts/contracts/`).
Ni este servidor ni su operador pueden aceptar un voto por esta via sin una
prueba criptografica valida. En redes locales de Hardhat se despliega en su
lugar un `MockRootVerifier` (ver `packages/contracts/test/`), porque el
verificador real solo existe en redes publicas.

Por defecto se usa el dominio de pruebas de ZKPassport (`demo.zkpassport.id`,
en `devMode`), que acepta pruebas mock sin necesidad de un documento fisico.
Variables de entorno (deben coincidir en la web y en el despliegue del
contrato, o `votarConPruebaZk` rechaza toda prueba):

    # apps/web/.env.local
    NEXT_PUBLIC_ZKPASSPORT_DOMAIN=tu-dominio.com   # dominio propio, registrado en zkpassport.id
    NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false          # false para exigir pruebas reales (NFC), no mock

    # packages/contracts/.env
    ZKPASSPORT_DOMAIN=tu-dominio.com
    ZKPASSPORT_DEV_MODE=false

Para una demo publica con documentos reales, registra el dominio del
despliegue de Vercel en el dashboard de ZKPassport, desactiva `devMode` en
ambos sitios y vuelve a desplegar el contrato (`devModeZk` es inmutable,
fijado en el constructor).

## Identidad con certificado digital (Autofirma)

La via de certificado digital usa [Autofirma](https://github.com/ctt-gob-es/clienteafirma),
la herramienta oficial del Gobierno de España (hay que tenerla instalada):
el navegador le pide que firme un código aleatorio con el certificado
instalado (FNMT, DNIe...) y el servidor comprueba, en
`apps/web/lib/certificado-digital.ts`:

1. Que la firma CMS/CAdES es criptográficamente válida y cubre exactamente
   ese código.
2. Que el certificado encadena hasta una autoridad real (la FNMT-RCM o la
   Dirección General de la Policía). Las raíces de confianza están en
   `apps/web/lib/certificados-raiz/` (descargadas de sus webs oficiales).
3. Que el certificado no está revocado, consultando por OCSP al
   respondedor que el propio certificado declara.

A diferencia de ZKPassport, aquí no hay verificador on-chain: la
verificación ocurre en este servidor, y el voto se envía al contrato por la
vía "manual" existente (`votarManual`) con el nullifier ya calculado a
partir del certificado verificado. Tampoco se comprueba la edad (un
certificado no lleva la fecha de nacimiento) — ver docs/modelo-amenazas.md.

Variables de entorno (`apps/web/.env.local`):

    RETO_CERTIFICADO_SECRET=<una cadena aleatoria larga>
    FALLO_ABIERTO_REVOCACION=false   # true para aceptar el voto si OCSP no responde (no si SI consta revocado)

## Crear propuestas

Como todas las transacciones las firma la misma cuenta "relayer" del
servidor (el contrato no puede distinguir usuarios de la web), el control
de acceso a `/propuestas/nueva` vive a nivel de aplicación: hace falta una
clave de administrador. Variable de entorno necesaria
(`apps/web/.env.local` y Vercel):

    ADMIN_SECRET=<una cadena aleatoria larga>

## Estructura

civora/
  apps/web         -> Next.js: landing, propuestas, voto, resultados, verificador
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
- Verificacion ZK dentro del contrato, no en un servidor de confianza:
  `votarConPruebaZk` llama directamente al RootVerifier oficial de
  ZKPassport, así que no hay que confiar en que el operador de este sistema
  verifique honestamente antes de aceptar un voto.

## Aviso legal

Esta es una prueba de concepto tecnica, no un sistema habilitado para
elecciones oficiales vinculantes en Espana.
