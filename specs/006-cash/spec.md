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

## Incremento 3

AC-006-05 → REQ-006-01/02/03/04. Una caja conserva un turno y responsable; base más ventas en efectivo (sin digitales) determina esperado; cierre conserva contado/diferencia y se sincroniza después de ventas previas, sin duplicados.

Alcance: primera venta completa de la hoja de ruta. Ver plan/tareas del incremento 3; restantes escenarios se conservan para incrementos 4/5/6/8.

Verificación del alcance de incremento 3: [evidencia](../../docs/evidence/increment-3.md). Los escenarios anteriores fuera de ese alcance permanecen pendientes.


## Incremento 4

Alcance implementado y verificado localmente. Consultar [plan](plan-increment-4.md), [tareas](tasks-increment-4.md) y [evidencia](../../docs/evidence/increment-4.md). No acredita puntos, ingresos/gastos/retiros manuales, mensajería, hardware ni la capacidad completa.

## Dirección vigente — sitio web único

La revisión del 15-09-2026 conserva estas reglas y sustituye el cliente de escritorio por módulos del mismo sitio web. Aplicar DEC-021 y [012](../012-unified-web/spec.md). Pruebas históricas de Electron/SQLite no sustituyen aceptación en navegador. Impresión, cajón y recuperación del perfil se verifican antes de operar; no exigir instalador de escritorio.
