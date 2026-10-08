# Comprobante interno de cierre v1

`/shift/close` de Caja web conserva `{shift}` y añade `shiftReceipt`. `/v2/state` añade `shiftReceipts`, los cierres disponibles en el perfil de la caja, ordenados por fecha descendente. No es un evento de sincronización nuevo.

`ShiftReceipt` contiene `id`/`shiftId` estables (ID del turno), `branchId`, `deviceId`, copia del turno cerrado, `totals`, seis filas `payments` y `movements` cronológicos con ID, referencia, fecha, responsable, motivo, importe, efecto en efectivo y pagos. No contiene costos ni cambia operaciones comerciales.

Importes string con precisión del dominio. Ventas usan `payments.applied`, nunca efectivo recibido antes del cambio. Devoluciones usan los importes efectivamente devueltos. Cada medio presenta ventas, devoluciones, ingresos, gastos, retiros, correcciones con signo y neto. Una corrección invierte la clase/importe del registro referido; su delta de efectivo no representa la contrapartida digital. Neto = ventas − devoluciones + ingresos − gastos − retiros + correcciones. La base entra solo en el arqueo. Propina y domicilio netos ya están incluidos en ventas y no se suman nuevamente.

El comprobante se guarda atómicamente con el cierre y su outbox. Leer/imprimir no crea outbox, notificaciones ni cobros. Registros compartidos/locales se deduplican por ID. Un libro compartido cerrado y confirmado permite reconstruir la misma identidad con el arqueo central. Cierres históricos del perfil se reconstruyen desde el libro disponible; no se inventan movimientos ausentes ni se consultan otras sucursales.

## Vista previa del turno abierto

`/v2/state` agrega `currentShiftPreview: ShiftPreview | null`. Tiene el mismo ID, totales, pagos y movimientos calculados desde el libro íntegro del turno. `shift.closedAtMs`, `shift.counted` y `shift.difference` permanecen `null`; `viewedAtMs` indica la fecha de consulta. Solo se genera para el turno abierto del perfil. No se persiste como comprobante de cierre, no agrega outbox/operación ni ejecuta `/shift/close`. Leer o imprimir no sincroniza automáticamente la cola; la acción existente de sincronizar y su temporizador siguen actualizando el estado. La vista incorpora esos cambios y pasa al comprobante definitivo si otro equipo confirma el cierre mientras se consulta.

`buildShiftReceipt` sigue rechazando turnos abiertos. `buildShiftPreview` rechaza turnos cerrados o con conteo/diferencia registrados. Ambos reutilizan el mismo cálculo monetario; ninguna consulta inventa un conteo, una diferencia ni una fecha de cierre.

## Presentación simplificada

AC-006-12/13: solo cambia la vista/impresión. Total de ventas = `totals.sales`; base = `shift.openingCash`; filas de ventas = `payments[].sales`; devolución de dinero = negativo de `totals.refunds`; retiro efectivo = negativo de la fila cash `withdrawal`; retiros digitales = negativo de la diferencia entre retiros totales y efectivo. Ingresos, gastos y correcciones adicionales conservan sus signos y se muestran si existen. Total de movimientos en el resumen = `openingCash + totals.net`, con precisión exacta; no sustituye `totals.net` guardado. Dinero en efectivo del cierre = `counted`, o `expected` en revisión, sin inventar conteo. El arqueo conserva esperado/diferencia reales. Propina/domicilio se muestran separados cuando existen, como conceptos ya incluidos en ventas.

El detalle individual y los controles permanecen en pantalla, excluidos de la impresión compacta. El identificador sigue siendo el real del turno. Los pagos de tarjeta no se separan entre débito/crédito porque el libro no conserva esa clasificación. Observaciones es un espacio en papel, sin campo comercial nuevo ni modificación de comandos/persistencia.
