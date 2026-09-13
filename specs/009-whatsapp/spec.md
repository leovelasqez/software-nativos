# 009 — Notificaciones por WhatsApp

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, sección 12.

## Requisitos

- REQ-009-01: configurar destinatarios, frecuencia y agrupación de alertas por sucursal; integración mediante WhatsApp Business Platform.
- REQ-009-02: alertar al llegar o bajar del mínimo, con bodega/artículo/saldo/unidad/mínimo; evitar mensajes por cada venta repetida del mismo faltante.
- REQ-009-03: notificar cada cierre confirmado y sincronizado, con responsable, horario, ventas/medios, entradas/salidas/devoluciones, base, contado/esperado/diferencia y propinas/domicilios separados.
- REQ-009-04: procesar pendientes, errores y estados de entrega; incluir enlace autenticado al reporte completo y no bloquear ventas por fallas de mensajería.

## Estados y fronteras

Configuración inicial confirmada: destinatarios dueño y encargado del local; resumen de mínimos diariamente a las 8:00 a. m. de America/Bogota; cierre inmediato después de confirmación y sincronización. Números y emisor pendientes de configurar. Esta aceptación del comportamiento no autoriza mensajes reales durante desarrollo.

Evento comercial confirmado → elegibilidad/agrupación → pendiente de envío → respuesta del proveedor → estado de entrega. Diferenciar rechazo, fallo recuperable y entrega incierta; no equiparar un timeout a «no enviado».

No hay envío real autorizado por la existencia de esta especificación. Emisor, plantillas, destinatarios y costo siguen pendientes de configurar y validar.

## Aceptación

- AC-009-01 → REQ-009-01/02. Dado un faltante ya incluido en el aviso del período, cuando se realizan más ventas del mismo artículo, entonces se respeta la regla de agrupación y no se emite un aviso por venta.
- AC-009-02 → REQ-009-02. Dado un corte con ventas y una reposición posterior, cuando se sincronizan los movimientos, entonces se evalúa el saldo actualizado antes de decidir si avisar.
- AC-009-03 → REQ-009-03/04. Dado un cierre cuya sincronización se repite, cuando se procesa, entonces se mantiene una sola intención de notificación ligada al cierre.
- AC-009-04 → REQ-009-04. Dado el proveedor inaccesible o una respuesta incierta, cuando se intenta notificar, entonces venta/cierre siguen confirmados, el estado es visible y se aplica la política de recuperación sin reenvíos ciegos.

- AC-009-05 → REQ-009-01/02/03. Dada la configuración inicial, cuando corresponde el resumen diario a las 8:00 a. m. de Colombia, entonces se genera para dueño y encargado del local; cuando se confirma y sincroniza un cierre, su aviso se genera sin esperar el resumen del día siguiente.

## Dependencias y pendientes

003/006/007/008. DEC-010 debe cerrar sus datos de entorno y recuperación antes del diseño final de envíos; destinatarios por rol y horarios ya están confirmados. Validar contratos actuales del proveedor al implementarlo. Evidencia: pendiente.
