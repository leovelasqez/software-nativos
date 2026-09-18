# Plan técnico — 013 Ciclo de vida de catálogo

Estado: Verificado localmente. Referencia: `spec.md`. Autorización local: confirmación del usuario del 17-09-2026.

## Incremento seleccionado

Incluye REQ-013-01 a REQ-013-04 y AC-013-01 a AC-013-04: archivar/restaurar productos y ocultar su artículo terminado automático. Excluye borrar historia, archivar materias primas independientes, modificar ventas/pedidos existentes y garantizar revocación inmediata de cachés offline.

## Diseño

La migración aditiva agrega `archived_at` a `catalog_products` e `inventory_items`. El API transaccional de catálogo expone transiciones `archive` y `restore`, bloqueadas por revisión, con el mismo control de idempotencia, autorización y auditoría de las mutaciones existentes. El artículo terminado se identifica por el ID compartido; la transición actualiza ambos registros en la misma transacción.

Las consultas operativas filtran `archived_at IS NULL`. `GET /api/products/archived` es la lectura administrativa explícita y paginada. Las versiones inmutables y movimientos no se modifican. La UI de Administración muestra archivados de forma diferenciada y permite restaurarlos; Caja sólo recibe productos operativos tras sincronizar.

## Contratos

`contracts/catalog-lifecycle-v1.json` complementa el contrato base con la lista de archivados y las rutas POST de transición; `contracts/catalog-inventory-v1.md` documenta su relación con el catálogo operativo. Las mutaciones conservan cookie, `X-Nativos-Request`, `branchId`, `operationId`, `reason` y `expectedVersion`; devuelven 400/401/403/404/409 según el contrato.

## Migración y recuperación

La migración 016 es aditiva, conservando nulos para todos los registros existentes. Un fallo revierte las dos marcas de archivado, operación idempotente y auditoría. Restaurar elimina la marca, nunca borra versiones, movimientos ni comprobantes. La migración se prueba en PostgreSQL aislado y se valida por el mecanismo existente de checksum.

## Pruebas y operación

La integración cubre transición, idempotencia, conflicto, filtro de catálogo e inventario y conservación histórica. Se ejecutan contratos de navegador, typecheck, pruebas unitarias, integración focalizada, build y comprobación local. Se archivaron los cinco productos creados por error y, por decisión posterior 8A, `Agua botella demo`.

## Riesgos abiertos

Un cliente Caja sin conexión puede conservar un snapshot previo hasta sincronizar; es un límite explícito de REQ-013-04. No se cambia la política de inventario negativo ni se inventan existencias iniciales para la venta pendiente.
