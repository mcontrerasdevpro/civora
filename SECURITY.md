# Política de seguridad

Civora es una prueba de concepto de votación digital. **No está habilitada
para elecciones oficiales ni vinculantes**, pero tratamos cualquier
vulnerabilidad como si lo estuviera.

## Cómo reportar una vulnerabilidad

**No abras un issue público ni un pull request** con los detalles de una
vulnerabilidad. Repórtala en privado por una de estas vías:

1. **GitHub Private vulnerability reporting** (preferida): en este
   repositorio, pestaña *Security* → *Report a vulnerability*.
2. **Correo electrónico:** [contacto@nexuraia.com](mailto:contacto@nexuraia.com),
   con el asunto «Seguridad Civora».

Incluye, si puedes:

- Componente afectado: contrato (`packages/contracts`), web y API
  (`apps/web`) o capa de identidad (`packages/zk-identity`).
- Descripción del fallo e impacto: qué puede hacer un atacante y con qué
  requisitos.
- Pasos para reproducirlo o una prueba de concepto mínima.
- Commit o despliegue en el que lo has observado.

Acusaremos recibo, te mantendremos informado de la evaluación y la
corrección, y acordaremos contigo cuándo publicarlo. Si quieres, te
citaremos en el aviso y en la [auditoría](docs/auditoria-seguridad.md).

## Alcance

**Incluido:** el código de este repositorio y la demo pública desplegada a
partir de `main` en `civora.nexuraia.com`.

**Fuera de alcance:**

- Fallos de terceros (ZKPassport, Autofirma, FNMT, proveedores RPC,
  Easypanel, Neon): repórtalos a sus responsables.
- Problemas ya documentados como abiertos en
  [docs/auditoria-seguridad.md](docs/auditoria-seguridad.md) y
  [docs/modelo-amenazas.md](docs/modelo-amenazas.md), salvo que aportes una
  forma nueva o más grave de explotarlos.
- Ataques de denegación de servicio, ingeniería social y spam.

## Buenas prácticas al investigar

- Usa un nodo Hardhat local o tu propio despliegue en Sepolia
  ([AGENTS.md](AGENTS.md#comandos)); no satures la demo pública.
- No uses certificados ni documentos de identidad de otras personas, ni
  publiques datos personales que puedas obtener.
- Accede solo a los datos imprescindibles para demostrar el fallo.

## Versiones con soporte

Solo la rama `main`. Las correcciones se publican en `main` y en la demo
desplegada desde ella.
