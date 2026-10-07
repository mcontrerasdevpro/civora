# 0002. Capa de identidad aislada

- **Estado:** aceptada
- **Fecha:** 2026-10-05 (documenta una decisión inicial del proyecto)

## Contexto

La identidad depende de terceros (SDK de ZKPassport, Autofirma) que pueden
cambiar o sustituirse, por ejemplo por la Cartera Europea de Identidad
Digital (eIDAS 2.0).

## Decisión

`packages/zk-identity` expone una interfaz propia: crear la solicitud de
verificación y obtener los parámetros para el contrato. La web no importa
el SDK de ZKPassport directamente.

## Alternativas

- **Usar el SDK directamente en la web:** menos código, pero acopla toda la
  aplicación a un proveedor.

## Consecuencias

- Cambiar de proveedor afecta a `zk-identity` y al verificador del
  contrato, no al resto de la web.
- Los cambios en esta capa siguen la fase que les corresponde en el
  [ROADMAP](../ROADMAP.md).
