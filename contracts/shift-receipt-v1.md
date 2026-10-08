# Comprobante interno de cierre v1

`/shift/close` de Caja web conserva `{shift}` y añade `shiftReceipt`. `/v2/state` añade `shiftReceipts`, los cierres disponibles en el perfil de la caja, ordenados por fecha descendente. No es un evento de sincronización nuevo.

`ShiftReceipt` contiene `id`/`shiftId` estables (ID del turno), `branchId`, `deviceId`, copia del turno cerrado, `totals`, seis filas `payments` y `movements` cronológicos con ID, referencia, fecha, responsable, motivo, importe, efecto en efectivo y pagos. No contiene costos ni cambia operaciones comerciales.

Importes string con precisión del dominio. Ventas usan `payments.applied`, nunca efectivo recibido antes del cambio. Devoluciones usan los importes efectivamente devueltos. Cada medio presenta ventas, devoluciones, ingresos, gastos, retiros, correcciones con signo y neto. Una corrección invierte la clase/importe del registro referido; su delta de efectivo no representa la contrapartida digital. Neto = ventas − devoluciones + ingresos − gastos − retiros + correcciones. La base entra solo en el arqueo. Propina y domicilio netos ya están incluidos en ventas y no se suman nuevamente.

El comprobante se guarda atómicamente con el cierre y su outbox. Leer/imprimir no crea outbox, notificaciones ni cobros. Registros compartidos/locales se deduplican por ID. Un libro compartido cerrado y confirmado permite reconstruir la misma identidad con el arqueo central. Cierres históricos del perfil se reconstruyen desde el libro disponible; no se inventan movimientos ausentes ni se consultan otras sucursales.
