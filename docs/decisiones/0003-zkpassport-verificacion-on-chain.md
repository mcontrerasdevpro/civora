# 0003. ZKPassport con verificación dentro del contrato

- **Estado:** aceptada
- **Fecha:** 2026-10-05

## Contexto

Si un servidor verifica la prueba de elegibilidad y luego envía el voto,
hay que confiar en que el operador lo haga honestamente: podría aceptar una
prueba inválida o inventar votos.

## Decisión

La prueba ZKPassport (modo `compressed-evm`) llega sin verificar a
`VotacionAnonima.votarConPruebaZk`. El contrato llama al RootVerifier oficial
de ZKPassport y comprueba edad mínima, nacionalidad, dominio y que la prueba
se generó para esa propuesta. El nullifier se deriva de la prueba ya
verificada. En Hardhat local se usa `MockRootVerifier`.

## Alternativas

- **Verificar en el servidor:** más barato en gas, pero el operador vuelve a
  ser de confianza.
- **Verificar en el navegador:** no ofrece ninguna garantía a terceros.

## Consecuencias

- Ni el servidor ni el relayer pueden aceptar un voto ZK sin prueba válida.
- Coste de gas por voto y dependencia del RootVerifier publicado en cada red.
- `devModeZk` es inmutable: cambiarlo exige desplegar otro contrato.
- No resuelve el secreto de papeleta: opción y nullifier son públicos
  ([Fase 2](../ROADMAP.md#fase-2-maci-y-auditoría-externa)).
