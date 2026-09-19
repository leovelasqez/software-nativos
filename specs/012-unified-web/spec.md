# 012 — Sitio web único
Estado: verificado localmente en el alcance de la transición; ver docs/evidence/unified-web.md. Autorización: cambio de dirección solicitado el 15-09-2026; usuario confirma conservar siete días offline.

- REQ-012-01: una dirección y sesión web para Administración y Caja; sin Electron ni servicio POS instalado como requisito del producto.
- REQ-012-02: conservar todas las reglas implementadas en 0–5. Caja conserva pedidos, turnos, comprobantes, outbox y canjes inciertos en el navegador; siete días offline y recuperación tras cerrar/reabrir.
- REQ-012-03: múltiples pestañas no repiten operaciones ni permiten turnos simultáneos. Confirmar éxito solo después de persistencia atómica y acuse cuando corresponda.
- REQ-012-04: conservar datos anteriores y protocolo central; migración explícita y verificable desde SQLite. No sustituir una instalación con pendientes ni borrar archivos.
- REQ-012-05: actualizar arquitectura, instrucciones, ruta de entrega y aceptación de hardware/respaldos al entorno web.

AC-012-01: navegar Administración/Caja en un origen conservando sesión, tema y pedido.
AC-012-02: cortar red, recargar navegador, cobrar, reiniciar contexto y reconectar sin perder/duplicar venta, efectivo, stock o puntos.
AC-012-03: dos pestañas actúan sobre la misma revisión; solo una confirma, la otra recibe conflicto. Reintento de operación idéntica conserva resultado.
AC-012-04: canje central con acuse perdido conserva intención; recuperación/cancelación no vuelve a cobrar.
AC-012-05: compatibilidad de datos históricos y rechazo de reemplazo inseguro; las pruebas antiguas no acreditan automáticamente IndexedDB.

AC-012-06: dado un perfil de Caja sin pendientes cuyo cursor central ya avanzó, al autorizarlo el navegador adopta el cursor central antes de crear otra operación. Si ya existe una cola local que colisiona con ese cursor, la Caja bloquea nuevas escrituras, distingue el conflicto de una desconexión y permite una conciliación explícita que conserva IDs, payloads y orden local, reasigna solo la cadena causal y elimina cada pendiente únicamente después de su acuse.

AC-012-07: dada una venta pendiente conservada como `reconciliation_required` por un rechazo anterior de existencias insuficientes, cuando el operador solicita reintentarla, entonces Caja reenvía la misma operación sin cambiar ID, payload, hash, secuencia ni predecesor. El servidor aplica la regla vigente de REQ-003-03: confirma el cobro y deja el saldo negativo con alerta; si vuelve a rechazarla, la operación permanece guardada y bloqueada para revisión.

No cambia la regla de canje solo online ni las operaciones administrativas online. Impresión/cajón requieren ensayo real desde navegador. Cerrar todas las pestañas suspende la sincronización hasta volver a abrir; no depender de Background Sync. Borrar datos del sitio o perder el perfil puede perder pendientes no sincronizados.
