# Contrato v1 — Informes y Excel (incremento 6)

Estado: implementación de informes operativos verificada. DEC-005 está resuelta con conciliación causal; costos y márgenes históricos siguen fuera del informe hasta que cada salida tenga valoración explícita, sin reescribir historia. Todas las rutas son online, autenticadas y `Cache-Control: no-store`.

## Consulta

`GET /api/reports/{kind}?branchId&from&to&after&limit` admite `kind` `sales`, `cash`, `inventory`, `purchases`, `waste` o `loyalty`; filtros adicionales solo se aceptan cuando el tipo los documenta (producto, cliente, proveedor o medio). `from` y `to` son fechas ISO `YYYY-MM-DD`, inclusivas, interpretadas en `America/Bogota`. La respuesta contiene `{context,items,totals,nextCursor}`. `context` incluye filtros efectivos y, por sucursal incluida, `lastSynchronizedAt` o `null` cuando se desconoce.

`totals` separa productos, descuentos, canje, propina, domicilio, devoluciones, efectivo y digitales. No transforma una devolución en venta ni mezcla propina/domicilio con productos. Para una consulta fijada, los totales de pantalla y exportación usan los mismos hechos y alcance.

Cada consulta y exportación se ejecuta en una transacción PostgreSQL `REPEATABLE READ READ ONLY`, de modo que filas, totales y contexto proceden de la misma instantánea aunque haya operaciones concurrentes.

## Exportación

`GET /api/reports/{kind}/export` acepta los mismos filtros excepto cursor y límite. Devuelve `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` con nombre que identifica tipo y período. Incluye todas las filas autorizadas, no la página actual, con hojas **Contexto**, **Datos** y **Totales**. Un actor que carece de `cost.read` nunca recibe columnas de costo o margen, ni en el archivo ni mediante acceso directo a la ruta.

## Revisión del 09-10-2026

Los límites de página son enteros de 1 a 100 y los cursores admiten los identificadores compuestos del propio informe. Fechas inexistentes, límites malformados y cursores inválidos devuelven 400. Los totales conservan hasta 24 dígitos enteros y seis decimales, de acuerdo con el dominio y `numeric(30,6)`.

La comparación y orden de cursores usa la misma relación por ID, incluyendo mayúsculas y minúsculas, para no omitir filas. Los comprobantes v1 conservan `subtotal`/pago único y se normalizan con el dominio existente para participar en totales y filtros de medios; no se modifican sus registros históricos ni sus líneas.

Compras conserva los textos históricos `efectivo`, `tarjeta`, `transferencia`, `otro` y admite filtros equivalentes `cash`, `card`, `transfer`, `other`, además de los medios canónicos ya existentes. Consulta y Excel aplican la misma equivalencia. Fidelización incluye ajustes sin venta y filtra por sucursal y fecha del propio movimiento de puntos, en Bogotá, conservando la referencia de venta cuando existe.

Excel serializa datos de usuario como texto, sin convertirlos en fórmulas. Se retiran únicamente caracteres no admitidos por XML 1.0 para producir archivos que abren correctamente, preservando Unicode, tabuladores y saltos de línea válidos.
