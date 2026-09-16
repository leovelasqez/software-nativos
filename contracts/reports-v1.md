# Contrato v1 — Informes y Excel (incremento 6)

Estado: implementación verificada excepto costos y márgenes bloqueados por DEC-005. Todas las rutas son online, autenticadas y `Cache-Control: no-store`.

## Consulta

`GET /api/reports/{kind}?branchId&from&to&after&limit` admite `kind` `sales`, `cash`, `inventory`, `purchases`, `waste` o `loyalty`; filtros adicionales solo se aceptan cuando el tipo los documenta (producto, cliente, proveedor o medio). `from` y `to` son fechas ISO `YYYY-MM-DD`, inclusivas, interpretadas en `America/Bogota`. La respuesta contiene `{context,items,totals,nextCursor}`. `context` incluye filtros efectivos y, por sucursal incluida, `lastSynchronizedAt` o `null` cuando se desconoce.

`totals` separa productos, descuentos, canje, propina, domicilio, devoluciones, efectivo y digitales. No transforma una devolución en venta ni mezcla propina/domicilio con productos. Para una consulta fijada, los totales de pantalla y exportación usan los mismos hechos y alcance.

Cada consulta y exportación se ejecuta en una transacción PostgreSQL `REPEATABLE READ READ ONLY`, de modo que filas, totales y contexto proceden de la misma instantánea aunque haya operaciones concurrentes.

## Exportación

`GET /api/reports/{kind}/export` acepta los mismos filtros excepto cursor y límite. Devuelve `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` con nombre que identifica tipo y período. Incluye todas las filas autorizadas, no la página actual, con hojas **Contexto**, **Datos** y **Totales**. Un actor que carece de `cost.read` nunca recibe columnas de costo o margen, ni en el archivo ni mediante acceso directo a la ruta.
