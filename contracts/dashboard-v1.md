# Resumen operativo v1

GET /api/dashboard?branchId={id|all}. Autenticación web, Cache-Control: no-store, data.read sobre cada sucursal. all incluye solo las sucursales del actor. Rechazar filtros desconocidos, ausentes o sin permiso. Fecha del servidor en America/Bogota, mes desde el día 1 hasta hoy. Una instantánea de lectura repetible.

Respuesta: context {today,monthStart,timeZone,branchIds,generatedAt,lastSynchronizedAt}; day y month {sales,saleCount,refunds}; ticketAverage (null sin cobros hoy); daily [{date,sales}]; topProducts [{productId,name,presentation,quantity}]; inventoryAlerts [{itemId,name,branchId,branchName,warehouseId,warehouseName,baseUnit,quantity,minimum}]. Importes/cantidades decimales string. Sin costos, márgenes, clientes ni ventas completas.

- Ventas: productos efectivamente pagados después de descuentos/canje/redondeo (paidAmount de las líneas), menos productos devueltos en el período. Excluye propina/domicilio. Comprobantes v1: total pagado, sin propina/envío. Devoluciones afectan su propia fecha y pueden dar netos negativos.
- Contador: cobros confirmados, cada cobro parcial con comprobante propio. Pedidos guardados y devoluciones no cuentan como ventas.
- Ticket: productos pagados en los cobros de hoy antes de devoluciones posteriores / cobros de hoy; redondeado al peso, null sin cobros. Aclarar base en pantalla.
- Top 5: unidades vendidas menos devueltas en el mes por productId; conserva fracciones. Empates por nombre/ID; excluir saldos no positivos. Nombre/presentación del comprobante más reciente conocido.
- Alertas: existencias por artículo/bodega menores o iguales al mínimo configurado, incluyendo negativos. Solo artículos activos, igual que Inventario; archivar no elimina sus ventas históricas del Resumen. No inventar mínimos ni sumar bodegas. Identificar sucursal y bodega; sin costos.
- Sincronización: máximo last_sync_at por sucursal, null si desconocido. Indicar que los indicadores incluyen solo operaciones recibidas; esa fecha no asegura que no existan pendientes offline.

Sin datos: importes/contadores 0, ticket null, ranking/alertas vacíos y días del mes en 0. Error no equivale a cero. Respuestas de otra sucursal no sustituyen la selección actual.
