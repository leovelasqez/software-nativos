# Contrato v1 — Movimientos manuales de caja

Estado: implementable en incremento 6. Los movimientos se crean desde Caja únicamente con conexión y se sincronizan en la misma cadena causal del turno.

`cash.movement` contiene `shiftId`, `movementId`, `class` (`income`, `expense`, `withdrawal` o `correction`), `method`, `amount`, `reason` y `occurredAtMs`. El importe siempre es positivo. `income` suma al efectivo esperado solo si el medio es `cash`; `expense` y `withdrawal` lo restan solo si el medio es `cash`; los medios digitales se conservan separados y su delta de efectivo es cero.

Una corrección declara además `reversesMovementId`. Debe referenciar un movimiento confirmado del mismo turno, con el mismo medio e importe, y genera únicamente su contrapartida. No se actualiza ni elimina el registro original. El servidor rechaza turnos cerrados, ajenos, de otra caja, eventos anteriores a la apertura y un segundo intento con la misma operación pero contenido distinto. La respuesta idempotente es el acuse original.

El cierre calcula `opening_cash + ventas/refunds en efectivo + sum(cash_delta)` sobre el libro confirmado. De esta forma consulta, cierre e informes futuros parten de los mismos hechos. Propinas y domicilios no se convierten en movimientos manuales.
