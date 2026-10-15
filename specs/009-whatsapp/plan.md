# Plan técnico — Notificaciones confirmadas, incremento 7B

## Incremento autorizado del 15-10-2026 (prevalece sobre el diseño histórico)

Estado: verificado localmente; publicación en staging en curso. REQ-009-05 a 08, AC-009-05 a 11. Sólo dueño; un cierre más consolidado diario por evento, mínimos consolidados a las 08:00 con recuperación durante el mismo día. Entrega real desactivada y despliegue sólo staging.

Dominio `notification-report.ts`: datos tipados de instantánea, formateo del mensaje y filas Excel. Persistencia `notification-reports.ts`: cálculo compartido `buildShiftReceipt`, normalización de ventas históricas y consultas del día por sucursal. El cierre crea instantánea dentro de su transacción existente; despacho posterior fuera del lock comercial. La última sincronización del evento causal se incluye aunque el acuse se termine de guardar después. Los resúmenes declaran cobertura limitada a operaciones sincronizadas y no aseguran ausencia de pendientes offline.

Migración aditiva 024: modo `legacy/preview/live`, metadatos de despacho, historial append-only de estados del proveedor y `notification_daily_runs` para completar también cortes sin faltantes. Mantener intenciones viejas sin reinterpretarlas ni borrarlas. Las nuevas usan versión 2, exclusivamente destinatario lógico owner y la lista completa de sucursales incluida en el payload. La clave diaria usa una sucursal ancla sólo para compatibilidad de almacenamiento; la autorización comprueba todas las sucursales del documento. Las muestras manuales tienen clave propia y siempre modo preview, sin interferir con el corte automático. La respuesta de sincronización despierta el despachador después del commit; la evaluación por minuto recupera pendientes.

`whatsapp.ts`: configuración validada desde entorno, URL fija de Meta con versión explícita, plantilla con un parámetro de resumen sin saltos de línea y botón URL dinámico con ID. `notification-delivery.ts`: reclamar con lock de fila, commit antes de red, estados accepted/sent/delivered/read además de fallos; backoff acotado, timeout/5xx incierto y recuperación de sending antiguo. Webhook admite firma HMAC sobre bytes originales, challenge verificado, deduplicación y protección de estados terminales. Correlación mediante ID y callback opaco del intento para recibir eventos incluso antes de terminar el POST. Verificar dueño activo y alcance antes de cada envío. No permitir URL o token arbitrarios desde la interfaz.

API/pantalla WhatsApp: estado de configuración sin valores secretos, lista paginada, detalle, Excel y simulación independiente, enlace `/?notification=ID` después de iniciar sesión. Mantener filtros por sucursal con comprobación integral de alcance. El modo preview nunca se despacha, incluso tras activación futura. No hay botón de activación en navegador.

Pruebas: dominio de importes/fechas/texto, integración PostgreSQL de generación/alcance/paginación/simulaciones/concurrencia/webhooks/timeout/reinicio; navegador con datos sintéticos, exportación, autenticación, escritorio/móvil, temas y accesibilidad. Verificar restauración de nuevas tablas en respaldo local. `npm run check` y recorridos E2E afectados antes de empaquetar un commit exacto y publicarlo en staging; comparar recursos públicos y fronteras de autenticación. No copiar datos ni credenciales de producción.

Pendientes operativos: portafolio Meta, elegibilidad de coexistencia del número comercial, receptor personal, plantillas aprobadas, versión Graph, credenciales, presupuesto y retención de proveedor. El desarrollo no depende de completar el alta. No almacenar datos reales de proveedor ni ejecutar envíos hasta su configuración y autorización posterior.

## Diseño histórico del incremento 7B

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
