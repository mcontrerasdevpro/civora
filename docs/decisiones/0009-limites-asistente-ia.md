# 0009. Límites del asistente de IA

- **Estado:** aceptada (el asistente no está implementado)
- **Fecha:** 2026-10-06

## Contexto

Un asistente conversacional ayudaría a personas con dificultades a recorrer
el proceso, pero un modelo de IA puede filtrar el voto a su proveedor,
sesgar la decisión o recibir instrucciones inyectadas en el contenido de una
propuesta. Si influyera en el voto, el Reglamento europeo de IA lo
clasificaría como de alto riesgo. Amenazas detalladas en el
[modelo de amenazas](../modelo-amenazas.md#asistente-de-ia-futuro-no-implementado).

## Decisión

**La IA ayuda con el proceso, nunca con la decisión, y nunca toca la
papeleta.**

- **Puede:** guiar la identificación, responder dudas del proceso, ayudar a
  navegar y leer literalmente la propuesta o un resumen neutral aprobado de
  antemano.
- **No puede:** conocer, sugerir ni confirmar la opción; tener herramientas
  para votar ni acceso a identidad, contrato o relayer; opinar sobre la
  propuesta.
- **Arquitectura:** servicio aislado de la aplicación de voto que se
  desconecta, y lo anuncia, en el paso de votar. La elección se hace con una
  interfaz determinista sin IA. Modelo alojado en la UE o local, registros
  sin datos de la sesión de voto y contenido de las propuestas firmado.

## Alternativas

- **Asistente integrado en el flujo de voto:** más fluido, pero el modelo
  vería la opción.
- **Sin asistente:** es la situación actual, hasta cumplir los criterios del
  [ROADMAP](../ROADMAP.md#asistente-de-ia).

## Consecuencias

- Si estos límites no pueden garantizarse, el asistente no se despliega.
- Cualquier diseño futuro debe demostrar con tests que no tiene acceso a la
  opción ni herramientas con efecto sobre el voto.
