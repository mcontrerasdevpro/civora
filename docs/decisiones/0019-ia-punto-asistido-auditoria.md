# 0019. IA, punto asistido y auditoría

- **Estado:** aceptada (diseño; sin implementar)
- **Fecha:** 2026-10-07
- **Amplía:** [ADR 0009](0009-limites-asistente-ia.md) (límites del asistente de IA)
- **Sustituye:** el «canal de papel» del diseño de voto asistido del
  [modelo de amenazas](../modelo-amenazas.md#inclusión-y-voto-asistido)
- **Relacionada:** [Fase 1](../ROADMAP.md#fase-1-semaphore), [Fase 2](../ROADMAP.md#fase-2-maci-y-auditoría-externa)

## Contexto

El diseño de voto asistido preveía tres canales: digital autónomo, punto
asistido presencial y papel, con un único canal por persona. Quedaban sin
decidir tres cosas:

- **El canal de papel:** cómo se cuenta y cómo se comprueba.
- **El punto asistido:** cómo se audita el software del quiosco.
- **La IA:** qué papel tiene más allá del asistente del ADR 0009.

Este ADR fija esas tres piezas a partir de un principio común.

## Principio

**El recuento es siempre determinista y reproducible.**

- Es lo que dicen el contrato y sus eventos públicos.
- Cualquiera puede rehacerlo con el mismo resultado: la página de
  resultados explica cómo.
- **La IA nunca cuenta, decide ni anula votos**, ni propone hacerlo
  ([ADR 0009](0009-limites-asistente-ia.md)).
- Toda decisión sobre la validez de un voto o de un punto la toman
  personas con un procedimiento escrito de antemano.

## Decisión

### 1. Sin canal de recuento en papel independiente

No habrá un tercer canal en el que se vote en papel y se escrute por actas,
ni un escrutinio paralelo basado en actas escaneadas (el modelo de
plataformas como scrutinia.com).

**Motivo:** un acta puede estar falseada desde su origen. Escanearla y
publicarla demuestra que la imagen no ha cambiado después, pero no que lo
que recoge sea cierto. Un canal así añadiría un recuento que no se puede
verificar de extremo a extremo junto a otro que sí.

Quedan dos canales de voto:

- **Digital autónomo:** el actual, con el móvil o el ordenador del votante.
- **Punto asistido:** presencial, ver abajo.

Cada persona sigue asignada a un único canal antes de congelar el censo
(Fase 1). El papel solo existe como **pista de auditoría dentro del punto
asistido** ([punto 3](#3-papel-como-pista-de-auditoría)).

### 2. Punto asistido: quiosco en cabina

- **Mismo voto verificable que el canal remoto:** el quiosco emite el
  mismo tipo de voto (en la Fase 1, prueba de pertenencia al censo y
  nullifier por propuesta) al mismo contrato. No hay un recuento aparte.
- **Identificación asistida:** personal acreditado ayuda a leer el DNIe o
  el pasaporte con el lector NFC del propio punto. La identidad de voto se
  genera y se destruye en la sesión, como ya prevé el modelo de amenazas.
- **Voto en solitario:**
  - Tras identificarse, el votante entra solo en la cabina; el personal no
    ve la pantalla.
  - Un acompañante solo entra si el votante lo elige, y se registra como
    «voto asistido», nunca su contenido.
  - El quiosco funciona en modo quiosco, sin red salvo hacia el relayer, y
    con la imagen del software verificada por su hash al arrancar.
- **Sin correlación por hora:** el personal sabe a qué hora vota cada
  persona. Si el voto llegara a la cadena al momento, en un punto con poca
  afluencia se podría deducir quién votó qué.
  - El quiosco guarda los votos ya firmados y los envía en lotes, con un
    retraso aleatorio y en orden aleatorio.
  - Lo que quede pendiente se envía antes del cierre.
- **Techo por censo:** ver el [punto 4](#4-techo-por-censo-en-cadena).

### 3. Papel como pista de auditoría

Es una pista de auditoría en papel verificada por el votante (VVPAT). El
flujo en la cabina es este:

1. El votante elige en la pantalla y confirma.
2. El quiosco **imprime una papeleta** detrás de una ventanilla. La
   papeleta lleva la opción, el código del punto y el de la propuesta.
   **Nada del votante:** ni nombre, ni documento, ni nullifier, ni hora,
   ni número de orden.
3. El votante comprueba la papeleta.
   - **Si coincide**, la confirma, la papeleta cae a la urna sellada y el
     quiosco firma el voto y lo pone en el lote de envío. El votante no se
     lleva nada que pruebe su voto.
   - **Si no coincide**, la rechaza. La papeleta cae a un sobre aparte de
     «anuladas», no se emite ningún voto digital, se registra una
     incidencia sin la opción y el votante vuelve a empezar.
   - **Con dos incidencias** en el mismo quiosco y la misma votación, el
     quiosco se retira del servicio y se precinta para su análisis.

El papel no se cuenta como voto: sirve para comprobar que el quiosco envió
a la cadena lo que el votante vio impreso.

#### Auditoría de limitación de riesgo (RLA)

Se hace en cada votación con puntos asistidos, con observadores y con un
procedimiento publicado antes de abrir la votación:

1. **Antes de abrir:** se publican el límite de riesgo (por ejemplo, 5 %),
   el método estadístico de comparación por lotes (el lote es la urna de
   un punto) y el procedimiento de sorteo.
2. **Al cerrar:** cada urna se precinta sin abrir. Se levanta un acta de
   custodia con el número de papeletas, los precintos y las firmas del
   personal y de los observadores presentes. El recuento digital de cada
   punto ya es público en cadena.
3. **Sorteo:** una semilla pública generada ante observadores (por
   ejemplo, con dados) y publicada. A partir de ella, cualquiera puede
   reproducir qué puntos salen elegidos, con más probabilidad para los que
   tienen más votos.
4. **Recuento manual** de las papeletas de cada punto elegido, con
   observadores de las partes y al menos uno independiente. Se anota el
   resultado por opción, firmado y publicado.
5. **Comparación** con el recuento en cadena de ese punto.
6. **Decisión estadística:**
   - Si las discrepancias no superan lo que permite el límite de riesgo, la
     auditoría termina.
   - Si lo superan, se amplía la muestra con nuevos puntos sorteados y, en
     el peor caso, se recuentan a mano todos los puntos asistidos.

**Si no coinciden:**

- **Menos papeletas que votos digitales en un punto:** quizá alguien
  confirmó sin dejar caer la papeleta (atasco), o el quiosco emitió votos
  sin papeleta. Se investigan los registros del quiosco y la custodia. La
  diferencia cuenta como discrepancia en la RLA.
- **Más papeletas que votos digitales:** posible relleno de urna o votos
  digitales perdidos o retenidos. Se revisan el lote de envío del quiosco
  y la custodia de la urna.
- **Mismo número, distinta opción:** es la señal más grave, porque indica
  que el quiosco envió algo distinto de lo impreso. El quiosco se precinta
  y se analiza su software contra el hash publicado. La muestra se amplía
  siempre.
- **El contrato no se modifica nunca:** es inmutable. La auditoría produce
  un resultado público («superada» o «no superada», con las
  discrepancias). Si no se supera, la decisión sobre los votos afectados
  es del órgano convocante según sus normas, nunca automática ni de una IA.
  La web muestra ese resultado junto al recuento, sin alterarlo.
- **Alcance:** la RLA solo audita los votos emitidos en puntos asistidos.
  El canal remoto no tiene papel. Su integridad depende de las pruebas
  criptográficas y del recuento público.

### 4. Techo por censo en cadena

**Ningún punto puede aportar más votos que personas tenía asignadas.**

- En la Fase 1, el censo congelado asigna cada persona a un canal y, en el
  canal asistido, a un punto.
- Antes de abrir, el contrato recibe para cada punto el número de personas
  asignadas (o la raíz de su subgrupo, de la que sale ese número).
- Cada voto de un punto lleva su código, probado como parte de la
  pertenencia al subgrupo.
- **El contrato lleva la cuenta por punto y rechaza el voto que superaría
  el techo.** Lo mismo para el canal remoto en su conjunto.

El techo no sustituye a la RLA, pero acota en cadena el daño de un punto
manipulado: no puede inventar votos por encima de su censo. Es un criterio
de aceptación de la [Fase 1](../ROADMAP.md#fase-1-semaphore).

### 5. IA: solo ayuda y avisos

Todo lo del [ADR 0009](0009-limites-asistente-ia.md) sigue vigente. Además:

- **Detección de anomalías:**
  - Solo con datos públicos y agregados: votos por punto y por hora,
    ritmo de envío de los lotes, gasto del relayer, rechazos del contrato
    por tipo y discrepancias de las auditorías.
  - Nunca con identidades, sesiones, IPs ni votos individuales.
  - Su salida es **un aviso a personas** (observadores, órgano convocante,
    operador) con los datos que lo motivan, reproducible por cualquiera con
    esos mismos datos públicos.
  - No tiene herramientas para actuar: no pausa, no anula, no reordena ni
    marca votos.
  - Primero van las reglas deterministas (por ejemplo, un punto que supera
    el ritmo máximo físico de una cabina); la IA las complementa.
- **Ayuda al ciudadano:**
  - Cualquier cifra que dé (votos, porcentajes, plazos) **sale siempre del
    recuento**, por la misma API que la página de resultados, y la cita con
    su origen. Nunca la genera ni la estima.
  - Si no puede leerla, lo dice. Antes del cierre no da resultados, igual
    que la web.
- **WhatsApp o Telegram:**
  - Solo para ayuda (dudas del proceso, cómo verificar un recibo) y avisos
    (apertura, cierre, publicación de resultados).
  - **Nunca para votar**, ni para pedir o recibir la opción, documentos de
    identidad, recibos o códigos.
  - Cada mensaje del canal lo recuerda, y la web avisa de que cualquier
    mensaje que pida votar por ahí es un fraude.
  - Alta voluntaria, solo con el número de teléfono, que queda en manos de
    un tercero (Meta o Telegram). Se acepta solo para ayuda y avisos.

## Alternativas

- **Mantener el canal de papel con escrutinio por actas:** descartado por
  el [punto 1](#1-sin-canal-de-recuento-en-papel-independiente).
- **Quiosco sin papel:** más simple, pero el software del quiosco quedaría
  sin auditoría independiente; habría que confiar en él.
- **Papeleta con un código que la enlace a su voto digital:** permitiría
  una RLA papeleta a papeleta, más eficiente. Se descarta porque el código
  sirve de recibo para un coaccionador y, junto con la hora, puede
  desanonimizar al votante.
- **IA que marque o anule votos sospechosos:** descartado: rompe el
  principio y entra de lleno en el alto riesgo del Reglamento europeo de
  IA.

## Consecuencias

- Los canales pasan de tres a dos. Hay que actualizar la asignación de
  canal de la Fase 1, el modelo de amenazas y la tabla de garantías del
  README.
- Cambios en el contrato de la Fase 1:
  - **cuenta y techo de votos por punto**;
  - **código de punto** en la prueba de pertenencia.
- **Quiosco:** hardware con lector NFC e impresora con ventanilla y urna,
  envío por lotes y software con hash publicado.
- **Procedimiento de RLA:** documento propio, con formularios de custodia y
  de recuento, que se publica antes de cada votación con puntos asistidos.
- **IA:** sigue sin implementarse. Su despliegue depende de los criterios
  del [ROADMAP](../ROADMAP.md#asistente-de-ia).

## Criterios de aceptación

- **Contrato (Fase 1):**
  - Rechaza el voto de un punto que ya alcanzó su techo y el del canal
    remoto por encima del suyo.
  - El techo y los subgrupos no cambian después de abrir.
- **Quiosco** (tests y prueba en un punto piloto):
  - Si el votante rechaza la papeleta, no se emite el voto digital.
  - El envío es por lotes, con retraso y orden aleatorios, y no queda nada
    pendiente al cierre.
  - La papeleta no contiene datos del votante ni la hora.
- **RLA:**
  - Simulacro completo con observadores: sorteo reproducible, recuento
    manual, comparación y escalado.
  - Una discrepancia introducida a propósito se detecta y escala.
- **IA:**
  - Una prueba de inyección de instrucciones no consigue que dé una cifra
    distinta del recuento.
  - No tiene herramientas con efecto sobre votos.
  - El canal de mensajería rechaza cualquier intento de votar o de enviar
    la opción.
