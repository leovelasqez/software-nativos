# Plan técnico — 014 Conciliación causal de costos

Estado: Verificado localmente.

## Diseño

Una tabla append-only conserva `warehouse_id`, `item_id`, `unit_cost`, `effective_from`, actor, motivo y fecha de creación. Las escrituras reutilizan idempotencia/auditoría de catálogo bajo el mismo lock. La proyección de costo vigente elige la conciliación más reciente y usa el inicial vigente sólo como antecedente. No actualiza `inventory_movements` ni ventas.

## Contrato

`contracts/cost-reconciliation-v1.json` expone lectura y alta por bodega. Ambas requieren sesión de dueño y permisos de costo; la escritura exige UUID, motivo y cadenas decimales exactas.

## Migración y pruebas

Migración 017 aditiva y protegida por trigger append-only. Integración cubre permisos, costo pendiente, idempotencia, precedencia, receta y conservación histórica. La interfaz vive en Inventario y sólo se renderiza para el dueño.
