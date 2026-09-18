# Plan técnico — Notificaciones confirmadas, incremento 7B

Estado: lista para implementación local de la cola y observabilidad. No autoriza ni configura un proveedor externo. Fuente: REQ-009-01 a 04, DEC-010 y sección 12 del plan funcional.

## Incremento seleccionado

Se implementa una frontera durable de notificaciones para dos hechos ya confirmados en PostgreSQL: saldo de inventario igual o menor al mínimo y cierre de turno confirmado por sincronización. La frontera materializa una intención idempotente, una vista de destinatarios lógicos y estados de entrega; **no** llama a WhatsApp Business Platform ni almacena números, tokens, plantillas o URL de proveedor.

El resumen de mínimos se prepara para cada sucursal a las 08:00 de `America/Bogota`, agrupando cada artículo/bodega bajo el mínimo en una sola intención diaria. Al arrancar y cada minuto el proceso del servidor revisa la ventana; la clave de fecha persistente impide duplicados tras reinicio o múltiples instancias. El cierre se encola sólo después del commit de `shift.close`; repetir sincronización o el mismo cierre devuelve la intención existente. Cuando se cree una intención se vuelve a consultar el saldo derivado, por lo que una reposición sincronizada antes del corte no genera una alerta obsoleta.

## Modelo y consistencia

`notification_intents` tiene una clave única de deduplicación y contenido causal inmutable; sólo su estado puede transicionar bajo el lock transaccional existente. Conserva tipo, sucursal, referencia causal, resumen seguro, destinatario lógico (`owner` o `branch_manager`) y estado `pending`, `sending`, `delivered`, `failed_retryable`, `failed_terminal` o `uncertain`. `notification_attempts` es append-only y conserva cada resultado del adaptador sin secretos ni contenido de credenciales. Timeout o respuesta sin identificador verificable quedan en `uncertain`, nunca se reenvían automáticamente a ciegas.

El payload de mínimos contiene sucursal, bodega, artículo, unidad, saldo y mínimo. El de cierre contiene turno, responsable, horario, ventas/medios, base, entradas, salidas, devoluciones, esperado, contado, diferencia, propinas y domicilios; incluye una ruta autenticada al informe, no un enlace con token. Los importes se obtienen de hechos inmutables y no de la interfaz local.

Un despachador sólo podrá tomar intenciones `pending` o `failed_retryable`. Para poder activarlo hará falta una configuración de proveedor validada, una política explícita de reintentos/retención y una decisión de reconciliación de estados inciertos; hasta entonces la aplicación expone la cola al dueño y permite simulación controlada en pruebas.

## Contrato y permisos

`contracts/notifications-v1.md` define datos, deduplicación, transición y proyección. Crear/listar/reintentar requiere `settings.manage` y dueño; las escrituras de hechos comerciales sólo pueden crear intenciones internas, nunca enviar. La lectura no expone destinatarios concretos, plantillas, token de proveedor ni identificadores de mensajes externos.

## Migración, recuperación y prueba

Agregar una migración aditiva con tablas append-only, índices de deduplicación y auditoría. Probar en PostgreSQL: una alerta agrupada por día, reposición previa al corte, repetición de cierre, rollback al fallar la intención, separación por sucursal, estados inciertos y permisos. Añadir pantalla de cola sólo después de que existan las proyecciones protegidas. En este incremento, el adaptador de envío es un doble de prueba; no hay llamada de red.

## Riesgos externos retenidos

DEC-010 mantiene pendientes números, emisor, plantillas, proveedor, costo y política operativa de entrega/reintento. DEC-012 mantiene retención y observabilidad operativa. La activación real requiere decisión y verificación con el servicio elegido; este plan no la infiere.
