# 003 — Inventario, compras y proveedores

Estado: verificado parcialmente — alcance del incremento 2; escenarios de venta/compras y costeo promedio pendientes. Implementación local autorizada y reiterada el 14-09-2026. Fuente: plan, sección 5.

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

001, 002, 004 y 007. DEC-004 resuelve la captura por encargado; queda diseñar la separación de datos locales. DEC-005 sigue pendiente para costeo. Evidencia del alcance 2: [incremento 2](../../docs/evidence/increment-2.md).

## Alcance verificable del incremento 2

- AC-003-06 → REQ-003-01/02. Encargado registra inicial y mínimo de artículo en su bodega; saldo se deriva del libro y reintentos concurrentes tienen un solo efecto. Segundo inicial vigente se rechaza; corrección revierte con referencia/motivo antes de nueva entrada.
- AC-003-07 → REQ-003-05. Costo inicial opcional exclusivo del dueño en API; encargado/cajero no lo reciben ni pueden escribirlo. Costo de receta queda pendiente si falta cualquier costo base de esa bodega. Costo cero explícito es válido y distinto de desconocido. Promedios de compras y negativos quedan para incremento 6.
- AC-003-08 → REQ-003-02 y REQ-001-04. Mutación, versión/movimiento, respuesta idempotente y auditoría comparten transacción. Fallo de auditoría revierte todos; reinicio conserva historia. Cajero sin inventory.manage y usuarios de otra sucursal reciben 403.

## Incremento 6 — alcance preparado

- AC-003-09 → REQ-003-01/02. Dado un encargado de Centro y un proveedor de su sucursal, cuando registra una compra de 1 kg de un artículo en gramos con precio e importe pagado, entonces se agregan 1.000 g una sola vez, se conserva la auditoría y el encargado puede consultar esa compra sin recibir costo de receta o margen.
- AC-003-10 → REQ-003-02. Dado un traslado despachado, cuando se recibe parcialmente y se reintenta la misma recepción, entonces el destino aumenta solo por las unidades recibidas una vez y no supera las despachadas.
- AC-003-11 → REQ-003-01/02. Dado un conteo físico diferente al saldo, cuando se confirma con motivo, entonces se conserva conteo y se agrega un ajuste causal sin editar el libro anterior.

Precisión UAT del 25-09-2026: AC-003-09/10/11 y el consumo interno de REQ-003-04 se aplican también a productos terminados. Comprar tres unidades agrega tres; despachar dos y recibir una más una conserva los saldos de ambas bodegas; conteo y consumo registran movimientos causales sin crear ventas. Los permisos, la conversión de unidades y los reintentos conservan sus reglas.

Costeo promedio, valoración de salidas y márgenes siguen bloqueados por DEC-005; ver el plan de incremento 6 y `contracts/inventory-operations-v1.md`.
