# Evidencia — Ciclo de vida de catálogo (013)

Fecha: 17-09-2026. Alcance local autorizado por el usuario: archivar cinco Productos Terminados creados por error y `Agua botella demo`, sin borrar historia.

## Trazabilidad

- Especificación: `specs/013-catalog-lifecycle/spec.md`.
- Plan y tareas: `specs/013-catalog-lifecycle/{plan,tasks}.md`.
- Contrato: `contracts/catalog-lifecycle-v1.json` y complemento de `catalog-inventory-v1.md`.
- Persistencia: migración aditiva `016-catalog-lifecycle.sql`.

## Resultado operativo comprobado

Se archivaron los productos con referencias `MP-LAC-005`, `MP-LAC-011`, `MP-FRU-016`, `MP-BAS-004`, `MP-END-003` y `DEMO-AGUA-600` mediante la interfaz de Administración. La consulta posterior comprobó para los seis `catalog_products.archived_at` e `inventory_items.archived_at`, conservando versiones históricas. El catálogo operativo pasó de siete a un producto: `frutos rojos`.

No se borraron versiones, movimientos, recetas, ventas, el turno ni el comprobante existente. Las materias primas reales con referencias terminadas en `-MP` no fueron archivadas.

## Verificación

| Comando o flujo | Resultado |
| --- | --- |
| `npm.cmd run typecheck` | Correcto |
| `npm.cmd run build` | Correcto |
| `npm.cmd test` | 33/33 correctas |
| Integración focalizada de catálogo | 15/15 correctas, incluido archivado/restauración idempotente |
| Consulta PostgreSQL acotada | 6/6 productos y artículos automáticos archivados; versiones preservadas |
| Interfaz Administración | Lista operativa muestra sólo `frutos rojos`; sección histórica muestra los seis y ofrece restaurarlos |

## Límites

La Caja que ya hubiera guardado un snapshot sin conexión puede mostrar esos productos hasta su siguiente sincronización. No se alteraron datos de inventario inicial ni se resolvió la venta pendiente sin existencias reales.
