# Plan técnico — Incremento 4

> Contexto histórico de incrementos 0–5. Para cambios nuevos prevalecen DEC-021 y specs/012-unified-web: un sitio único con Caja offline en navegador. Se conservan reglas y contratos comerciales.
Estado: implementado y verificado localmente. Autorización: «Continua con el siguiente incremento», 14-09-2026. Alcance: hoja de ruta 4, REQ-004-01 a 05 y devolución de 06; REQ-005-01/02; REQ-006-02/03 y REQ-007-01/02/04. Fidelización, impresión física y operaciones administrativas de inventario permanecen fuera.

## Diseño
Clientes globales únicos por documento, alta online autenticada por cualquier usuario y consulta paginada con alcance de acceso. Caché local de clientes sin costos. Pedidos múltiples por responsable, mostrador/mesa/domicilio manual, revisión optimista y selección local persistente. Nueva máquina de estados compartida: guardar, enviar comanda, cancelar cantidades indicando preparadas, cobrar selección, devolver cantidades de comprobante. Actor/equipo/sucursal, identidad y secuencia se conservan. Servidor replica el estado causal y recalcula efectos desde snapshots. El catálogo nunca se edita desde una línea.

Descuento porcentual o valor por línea, no superior al importe; seis decimales. En particiones, descuento fijo se reparte proporcionalmente y el residuo queda en la cantidad pendiente. Propina por cobro sobre productos netos, envío cobrado explícitamente sin exceder el saldo de domicilio del pedido. Pagos manuales combinados, digitales sin excedente y cambio solo efectivo. Total al peso, empate arriba; asignación de lo pagado a componentes por mayores restos, desempate estable. Cada cobro conserva cliente y comprobante. Comanda no descuenta; cancelar registra desperdicio únicamente por unidades identificadas como preparadas. Una línea enviada no cambia ingredientes/presentación sin registrar cancelación; cantidades nuevas permanecen sin enviar.

## Contratos
contracts/orders-v2.md y orders-v2.schema.json (comandos/eventos/cálculo); customers-v1.schema.json. Envoltura sync v1 admite payloadVersion 2 además de 1. API local /api/pos-local/v2/state, /command, /select; clientes /api/customers. Estado y comando cerrados, IDs UUID para idempotencia. Concesiones existentes v1 continúan válidas; acciones conocidas limitan cada evento v2. Cambiar descuentos requiere sale.discount además de order.write. Devolución solo sale.refund y turno propio; nunca cobra ni borra venta original. Devolución conserva límite acumulado por cantidad y método de devolución manual; inventario recuperable se identifica explícitamente, preparado no regresa automáticamente a ingredientes.

## Migración y recuperación
PostgreSQL 004 aditiva sin modificar 001–003; SQLite migración aditiva 2 con checksum propio sin alterar checksum original. Pedidos antiguos se convierten preservando IDs/versiones; recibos y outbox v1 se conservan y sincronizan antes de v2. Ventas v2 admiten varios cobros por pedido, cada uno único. Estado, venta, caja, stock, auditoría/comanda/devolución y outbox comparten commit local; central confirma después de su commit. Fallo y acuse perdido mantienen pendientes; sin borrado de datos operativos.

## Pruebas y operación
Dominio: descuentos/partición/redondeo/pagos, desperdicio y devoluciones acumuladas. Integración real SQLite/PostgreSQL/DPAPI: permisos, clientes duplicados, historia y secuencia, rollback/reinicio/reintento, compatibilidad v1. E2E de pedido/cliente/mesa/domicilio/comanda/división/descuento/medios/devolución, temas/móvil/teclado. Datos sintéticos aislados. Evidencia separada en incremento 4.

## Decisión confirmada
Confirmado por el usuario: permitir devolución de propina y domicilio seleccionados explícitamente, hasta sus saldos no devueltos. El medio de devolución se registra manualmente; permisos de sale.refund y turno propio, conservando cantidad y referencia originales.
