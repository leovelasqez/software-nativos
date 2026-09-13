# 006 — Caja, ingresos, salidas y turnos

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, sección 7.

## Requisitos

- REQ-006-01: un turno activo por caja y un cajero responsable; apertura con base y cierre con conteo.
- REQ-006-02: registrar entradas, gastos, retiros, ventas y devoluciones, diferenciando efectivo de medios digitales.
- REQ-006-03: calcular efectivo esperado, contado y diferencia; presentar propinas y cobros de domicilio separados, sin duplicarlos.
- REQ-006-04: persistir turnos offline y comunicar un cierre confirmado/sincronizado a informes y WhatsApp.

## Fronteras

Turno y libro de movimientos, relación con cobro/devolución, cierre y su momento de confirmación. Especificar cómo corregir un cierre confirmado mediante registro relacionado y cómo manejar movimientos tardíos antes de permitir esas acciones.

## Aceptación

- AC-006-01 → REQ-006-01. Dada una caja con turno abierto, cuando otro usuario intenta abrir un segundo turno, entonces se rechaza sin crear un turno adicional.
- AC-006-02 → REQ-006-02/03. Dada base de $150.000, entradas de ventas en efectivo de $386.000 y salida en efectivo de $50.000, sin otros movimientos, cuando se consulta el cierre, entonces se esperan $486.000. Ventas digitales no aumentan ese efectivo.
- AC-006-03 → REQ-006-03. Dado un efectivo esperado de $486.000 y contado de $480.000, cuando se confirma, entonces se registra diferencia de −$6.000 y responsable.
- AC-006-04 → REQ-006-04. Dado un cierre realizado offline, cuando reinicia Windows y luego sincroniza, entonces conserva el cierre y origina una sola solicitud comercial de notificación.

## Dependencias y pendientes

001/004/007/009. DEC-002/014 afectan redondeos, efectivo recibido/cambio y pagos fallidos. Datos de prueba sintéticos. Evidencia: pendiente.
