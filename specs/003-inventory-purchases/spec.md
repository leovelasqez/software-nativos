# 003 — Inventario, compras y proveedores

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, sección 5.

## Requisitos

- REQ-003-01: mantener existencias y mínimos por artículo/bodega con conversiones desde empaques a unidades base; materias primas, consumibles y productos listos para vender.
- REQ-003-02: registrar compras pagadas y proveedores, movimientos iniciales, traslados con despacho/recepción, conteos y ajustes con motivo. El encargado registra la compra completa de su local, incluidos precios y valor pagado, sin acceso a márgenes o costos de recetas. Operaciones administrativas online.
- REQ-003-03: contabilizar consumo al cobrar y permitir saldo negativo con alerta; preservar un solo efecto por venta.
- REQ-003-04: registrar desperdicio y consumo interno; en devoluciones reingresar solo cantidades recuperables y no duplicar consumos ya registrados.
- REQ-003-05: costo promedio ponderado por artículo/bodega, desconocidos identificados y márgenes pendientes cuando proceda, con acceso exclusivo del dueño.

## Fronteras

Libro de movimientos, saldo derivado, conversión y relación con compra/venta/devolución/traslado. No incluir lotes, vencimientos, producción por lotes ni cuentas por pagar. Precisar movimientos inversos y recepción parcial al diseñar los contratos.

## Aceptación

- AC-003-01 → REQ-003-01/02. Dado un artículo en gramos, cuando se recibe un empaque validado de 1 kg, entonces se registra una entrada de 1.000 g en la bodega elegida.
- AC-003-02 → REQ-003-03. Dado un saldo de 50 g y una venta que consume 100 g, cuando se cobra, entonces el saldo queda en −50 g con alerta; repetir la entrega de esa misma operación no vuelve a descontar.
- AC-003-03 → REQ-003-02/04. Dado un traslado o devolución, cuando se registra su movimiento confirmado, entonces se identifica el origen y no se duplican cantidades al reintentar.
- AC-003-04 → REQ-003-05. Dado un artículo sin costo fiable, cuando el dueño consulta el margen, entonces aparece pendiente en lugar de una utilidad calculada con costo cero; un cajero no recibe ese costo.

- AC-003-05 → REQ-003-02/05. Dado un encargado de Centro, cuando registra una compra completa con cantidades, precios y pago, entonces se acepta con auditoría y puede consultar esos importes en compras; solicitar costo de recetas o márgenes sigue siendo rechazado.

## Dependencias y pendientes

001, 002, 004 y 007. DEC-004 resuelve la captura por encargado; queda diseñar la separación de datos locales. DEC-005 sigue pendiente para costeo. Evidencia: pendiente.
