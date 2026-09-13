# 005 — Clientes, domicilios y fidelización

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, secciones 4, 8 y 9.

## Requisitos

- REQ-005-01: cliente único con nombre, documento y celular obligatorios, correo/dirección opcionales, búsqueda e historial. Alta online por cualquier usuario; clientes sincronizados seleccionables offline.
- REQ-005-02: domicilios manuales con dirección, costo, repartidor y estado; sin tienda ni integración automática con canales.
- REQ-005-03: módulo independiente de fidelización e inscripción online vinculada al cliente existente, saldo confirmado, pendiente e historial por compra/canje/ajuste.
- REQ-005-04: acumular automáticamente un punto entero por cada $1.000 pagados en productos elegibles, después de descuentos y excluyendo envío, propina y pagos con puntos. Sin vencimiento inicial ni acumulación por migración.
- REQ-005-05: canjear online con valor inicial de $10 por punto y máximo 20% de productos, verificando saldo central; incluir ganados/saldo en comprobante y revertir efectos de devoluciones.
- REQ-005-06: cualquier usuario consulta, inscribe y aplica canjes; solo dueño ajusta saldos y reglas con auditoría, sin recalcular operaciones anteriores. Excel de clientes/puntos mediante 008.

## Fronteras y estados

Libro de puntos ligado a identidad de compra y versión de regla. Distinguir pendiente de sincronización, confirmado, canje y ajuste. Reservas y confirmaciones de canje se diseñan con 007 antes de habilitar escritura. Definir cómo una corrección se representa sin borrar movimientos previos.

Cada cobro de cuenta dividida acumula puntos para su cliente y emite su comprobante. Al devolver una compra, revertir sus puntos generados aunque ya se hayan gastado: permitir saldo negativo, bloquear canjes sin saldo suficiente y seguir permitiendo compras. La asignación exacta de puntos en devoluciones parciales sigue pendiente del contrato.

## Aceptación

Base confirmada: productos a precio final con impuestos, después de descuentos y restando canjes para acumular; el límite de canje usa productos después de descuentos y antes del canje. Excluir siempre propina y envío. En devoluciones, restituir puntos canjeados y dinero realmente pagado proporcionalmente a productos devueltos, sin convertir puntos en dinero; revertir además puntos generados.

- AC-005-01 → REQ-005-01/03. Dado un documento ya registrado, cuando se intenta crear otro cliente con ese documento, entonces se indica el existente; inscribirlo no duplica su registro.
- AC-005-02 → REQ-005-04. Dados $9.000 en productos elegibles tras descuento y $1.000 de propina, sin canje ni envío, cuando se confirma la compra online, entonces se generan 9 puntos y se reportan en el comprobante.
- AC-005-03 → REQ-005-04/05. Dada una venta offline de un inscrito, cuando se cobra, entonces los puntos quedan pendientes y el comprobante distingue último saldo conocido; al sincronizar repetidamente se confirman una sola vez.
- AC-005-04 → REQ-005-05. Dado un saldo que alcanza para un solo canje y solicitudes concurrentes en Milán/Centro, cuando ambas intentan usarlo, entonces el conjunto de canjes confirmados no excede ese saldo.
- AC-005-05 → REQ-005-06. Dado un cajero, cuando intenta ajustar puntos mediante API, entonces se rechaza; un ajuste autorizado del dueño conserva motivo y saldo anterior/nuevo.

- AC-005-06 → REQ-005-04/05. Dado un cliente con 3 puntos disponibles y una devolución que revierte 10 puntos generados por la compra, cuando se confirma, entonces queda con −7 puntos, no puede canjear y sí puede comprar. Reintentar la misma devolución no vuelve a restar.

- AC-005-07 → REQ-005-04/05. Dados $20.000 en productos con impuestos después de descuentos, saldo suficiente y un canje de 100 puntos ($1.000), cuando se cobra sin otros ajustes, entonces el límite monetario de canje es $4.000 y se acumulan 19 puntos sobre $19.000.
- AC-005-08 → REQ-005-05. Dados dos productos iguales de $10.000 cada uno, pagados con 100 puntos ($1.000) y $19.000 en dinero, cuando se devuelve uno, entonces se restituyen 50 puntos usados y $9.500 en dinero. Nunca se devuelven $10.000 en dinero por ese producto. La reversión de puntos generados se ejecuta también una sola vez; el reparto de puntos enteros se detalla en el contrato.

## Dependencias y pendientes

001/004/007/008. DEC-006: reglas de negocio confirmadas; queda diseñar reparto de puntos enteros y redondeos en devoluciones parciales. DEC-007: transacción de canje ante fallos. No derivar estas políticas de las simulaciones de la maqueta. Evidencia: pendiente.
