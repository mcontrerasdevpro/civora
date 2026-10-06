# 0010. Demo pública en Sepolia con opt-in explícito

- **Estado:** aceptada
- **Fecha:** 2026-10-06
- **Matiza:** el cierre del hallazgo C-02 de la [auditoría](../auditoria-seguridad.md)

## Contexto

La Fase 0 cerró C-02 exigiendo, en cualquier red no local, un dominio
ZKPassport propio y `DEV_MODE=false`, tanto al desplegar el contrato como al
construir la web. Con eso la demo pública de Vercel, en Sepolia con pruebas
de demostración, deja de poder desplegarse: el build falla. Se quiere
mantener la demo sin reabrir el riesgo de que una red real acepte pruebas
falsas.

## Decisión

- Nueva variable `CIVORA_DEMO_TESTNET`. Solo el valor exacto `"true"` activa
  la excepción.
- **Contrato** (`scripts/deployment-config.js`): con el opt-in, el
  despliegue solo se permite si el chainId es **11155111 (Sepolia)**; exige
  `ZKPASSPORT_DEV_MODE` explícita (`true` o `false`) y `RELAYER_ADDRESS`. El
  dominio puede ser el de demo.
- **Web** (`lib/runtime-security.js`, en el build): con el opt-in, acepta
  el dominio de demo y exige `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE` explícita.
- La garantía la da el contrato: `devModeZk` es inmutable y solo puede
  activarse al desplegar en Sepolia. Una web mal configurada contra un
  contrato de red principal envía pruebas de demo que el contrato rechaza
  (`ModoDesarrolloNoPermitido`).
- El banner **MODO DEMOSTRACIÓN** se mantiene siempre que
  `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=true`.

## Alternativas

- **Dominio propio y pruebas reales en la demo:** sin excepción en el
  código, pero la demo exigiría un DNIe o pasaporte real por NFC.
- **Volver al comportamiento anterior (demo por defecto):** reabre C-02.
- **Comprobar el chainId también en la web:** exigiría una llamada RPC
  durante el build; no añade garantía porque la impone el contrato.

## Consecuencias

- Tests: el despliegue con opt-in falla en mainnet (1), Base (8453) o sin
  chainId; la web sin opt-in sigue rechazando la configuración de demo.
- `CIVORA_DEMO_TESTNET` debe retirarse al pasar a una red principal
  ([ROADMAP](../ROADMAP.md#paso-a-producción)).
- Procedimiento de despliegue: [despliegue-produccion.md](../despliegue-produccion.md).
