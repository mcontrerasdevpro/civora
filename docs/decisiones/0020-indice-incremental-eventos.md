# 0020. Índice incremental de eventos en civora-db

- **Estado:** aceptada
- **Fecha:** 2026-10-07
- **Relacionada:** [ADR 0013](0013-postgres-en-el-vps.md) (Postgres en el VPS), [ADR 0019](0019-ia-punto-asistido-auditoria.md) (recuento determinista)

## Contexto

`/resultados/<id>` rehace el recuento de una votación cerrada desde los
eventos públicos `VotoEmitido` del contrato, lo compara con el del contrato y
muestra los votos por vía.

Hacerlo en cada consulta, recorriendo la cadena, no es viable con el
proveedor RPC de la demo: el plan gratuito de Alchemy limita `eth_getLogs` a
**10 bloques por consulta**. Una votación de 90 días en Sepolia son unos
650 000 bloques, es decir, unas 65 000 consultas.

## Decisión

El servidor web mantiene un **índice incremental** de los eventos en
`civora-db`.

- **Indexador:** un ciclo periódico que se lanza al arrancar el servidor
  (`instrumentation.ts`, solo con `DATABASE_URL` y salvo
  `INDEXADOR_EVENTOS=false`). Código en `apps/web/lib/indexador-eventos.ts`.
  - En cada ciclo lee los bloques **finales** nuevos (etiqueta
    `finalized`; si el proveedor no la tiene, deja 64 bloques de margen),
    así que una reorganización no puede deshacer lo indexado.
  - Respeta el límite por consulta (`RPC_MAX_BLOQUES_LOGS`, 10 por
    defecto), con un máximo de consultas por ciclo
    (`INDEXADOR_CONSULTAS_POR_CICLO`, 100) y una pausa entre ellas
    (`INDEXADOR_PAUSA_MS`, 200).
  - Mientras va atrasado, encadena ciclos; al día, espera
    `INDEXADOR_INTERVALO_S` (30 s). Tras un error, espera 5 minutos.
- **Tablas:**
  - `eventos_voto`: contrato, transacción, índice del log, bloque,
    propuesta, nullifier, opción y selector de la función, que da la vía.
  - `indice_eventos`: último bloque procesado y cota inferior de su
    timestamp, por contrato.
  - Cada rango se guarda en **una transacción**, junto con el avance del
    último bloque. El avance usa `GREATEST`, de modo que dos procesos a la
    vez nunca lo hacen retroceder, y los eventos repetidos se ignoran.
- **Inicio:** desde `CONTRATO_BLOQUE_DESPLIEGUE`. Si falta, se busca el
  primer bloque con código en la dirección del contrato (búsqueda binaria;
  necesita un proveedor con datos históricos).
- **Verificación** (`lib/verificacion-resultados.ts`):
  - Una propuesta cuenta como completa en el índice cuando el timestamp del
    último bloque indexado es posterior a su cierre.
  - Mientras no lo es, la web dice que el índice se está completando y por
    qué bloque va.
  - Con el índice completo, el servidor recuenta los eventos y **lo compara
    siempre con `resultados()` del contrato**.
  - Si no coincide (o hay nullifiers repetidos), la API lo devuelve como
    discrepancia con las dos cifras. La web lo muestra en la sección de
    verificación y, además, fuera de ella, también en modo sencillo.
    **Nunca se oculta.**
- **La caché nunca sustituye a la cadena.** Las cifras de la página salen
  del contrato. El índice solo evita repetir consultas, sirve para el
  desglose por vía y para listar las transacciones, y siempre se contrasta.

### Reconstruir el índice desde cero

El índice no contiene nada que no esté en la cadena: se puede borrar sin
perder datos.

1. En la consola de `civora-db`:
   `TRUNCATE eventos_voto, indice_eventos;`
   Para un solo contrato:
   `DELETE FROM eventos_voto WHERE contrato = '<dirección en minúsculas>';`
   y lo mismo en `indice_eventos`.
2. No hace falta reiniciar: el siguiente ciclo empieza desde
   `CONTRATO_BLOQUE_DESPLIEGUE`, o desde el bloque de despliegue que
   encuentre, y encadena ciclos hasta ponerse al día.
3. Mientras tanto, `/resultados/<id>` dice que el índice se está
   completando.
4. Tiempo aproximado: unas 65 000 consultas por cada 90 días de Sepolia.
   Con los valores por defecto, unas pocas horas. Es más rápido con un
   proveedor que admita rangos mayores, subiendo `RPC_MAX_BLOQUES_LOGS`.

**Cuándo hacerlo:**

- Si la web muestra una discrepancia y el contrato (comprobado con tu
  propio nodo) da el recuento correcto, el índice está mal: se reconstruye.
- Al cambiar de contrato no hace falta, porque el índice va por dirección.

## Alternativas

- **Recorrer la cadena en cada consulta:** inviable con el límite de 10
  bloques; era la versión anterior de esta rama.
- **Plan de pago de Alchemy u otro proveedor:** sube el límite, pero no lo
  elimina (con pago, 10 000 bloques o 10 000 registros por consulta) y cada
  visita seguiría repitiendo consultas. Es compatible con esta decisión:
  basta subir `RPC_MAX_BLOQUES_LOGS`.
- **Indexador externo (The Graph u otro servicio):** añade un tercero en el
  camino de la verificación.
- **Guardar los eventos al enviar cada voto:** solo vería los votos que pasan
  por este servidor, no los que alguien envíe directamente al contrato.

## Consecuencias

- **`civora-db` guarda ahora datos de votos:** nullifier y opción de cada
  voto, por propuesta. Son exactamente los datos públicos de la cadena, sin
  nada más. Una filtración de la base de datos no revela nada que no se
  pueda leer ya en la cadena. El [ADR 0013](0013-postgres-en-el-vps.md)
  decía que la base no guardaba datos de votantes; sigue sin guardar
  identidades.
- **Manipular la caché no cambia el resultado.** Quien manipule la base de
  datos solo puede provocar una discrepancia visible, o alterar el desglose
  por vía o la lista de transacciones. Lo primero se ve y lo segundo se
  comprueba en el explorador.
- **Consumo:** el indexador gasta cuota del proveedor RPC de forma continua
  (al día, una consulta cada pocos ciclos) y la carga inicial es intensa.
- Con la separación en servicios (ADR 0017, en la PR #29), el indexador
  puede pasar a su propio proceso sin cambiar las tablas.

## Verificación

- **Tests:** rangos por ciclo, búsqueda del bloque de despliegue, recuento
  con duplicados y por vía, y E2E de índice completo, en curso y con
  discrepancia (también en modo sencillo).
- **Prueba de extremo a extremo en local:** nodo Hardhat con un contrato
  nuevo, Postgres de prueba y tres votos.
  - Tras el cierre, la API devolvió el recuento del índice coincidente, con
    3 votos por certificado.
  - Al borrar un evento de la caché, devolvió la discrepancia con las dos
    cifras.
  - Tras `TRUNCATE`, el indexador lo reconstruyó solo y volvió a coincidir.
