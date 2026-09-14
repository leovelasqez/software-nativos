# Índice de especificaciones y trazabilidad

Implementación local autorizada el 13-09-2026. **Incrementos 0 y 1 verificados en sus alcances**: políticas de 001/007 y fundamentos online de 001; ver [evidencia 0](../docs/evidence/increment-0.md) y [evidencia 1](../docs/evidence/increment-1.md). Las aceptaciones transversales de productos/ventas/offline siguen pendientes; nada está publicado. Resto de especificaciones: borrador, pendientes de sus incrementos. Los escenarios integrales continúan como criterios, no resultados obtenidos.

| Spec | Capacidad | Secciones del plan | Requisitos |
| --- | --- | --- | --- |
| [001](./001-foundation/spec.md) | Identidad, sucursales, permisos, UI y auditoría | 1–3, 10, 14 | REQ-001-01 a REQ-001-05 |
| [002](./002-catalog-recipes/spec.md) | Productos y recetas | 4, 6 | REQ-002-01 a REQ-002-05 |
| [003](./003-inventory-purchases/spec.md) | Inventario, compras y proveedores | 5 | REQ-003-01 a REQ-003-05 |
| [004](./004-sales/spec.md) | Pedidos, ventas, descuentos y comprobantes | 4 | REQ-004-01 a REQ-004-06 |
| [005](./005-customers-loyalty/spec.md) | Clientes, domicilios y fidelización | 4, 8–9 | REQ-005-01 a REQ-005-06 |
| [006](./006-cash/spec.md) | Caja, ingresos, salidas y cierres | 7 | REQ-006-01 a REQ-006-04 |
| [007](./007-offline-sync/spec.md) | Caja local, sincronización y recuperación | 14 | REQ-007-01 a REQ-007-06 |
| [008](./008-reports/spec.md) | Informes y Excel | 9, 11 | REQ-008-01 a REQ-008-04 |
| [009](./009-whatsapp/spec.md) | Alertas y cierres por WhatsApp | 12 | REQ-009-01 a REQ-009-04 |
| [010](./010-agent-api/spec.md) | API y MCP para agentes | 13 | REQ-010-01 a REQ-010-04 |
| [011](./011-migration-release/spec.md) | Migración, respaldo y puesta en marcha | 14–17 | REQ-011-01 a REQ-011-05 |

Las secciones 16–18 del plan aportan pruebas, límites y referencias transversales. Sus correspondencias principales son:

| Prueba del plan, sección 16 | Specs responsables |
| --- | --- |
| 1–2: consumo por venta | 002, 003, 004 |
| 3: altas y protección de costos | 001, 002, 005 |
| 4: descuentos y cancelación | 004, 003 |
| 5: división y pagos | 004, 006, 007 |
| 6–7: propina y puntos | 004, 005 |
| 8: offline | 001, 007 |
| 9: impresión | 004, 007, 011 |
| 10: caja | 006 |
| 11: Excel | 008 |
| 12: agentes | 010 |
| 13: WhatsApp | 009 |
| 14: migración y recuperación | 007, 011 |
| 15: interfaz | 001 y cada interfaz afectada |

## Cómo avanzar

Para una capacidad, completar su `spec.md` hasta resolver las preguntas que bloquean el incremento elegido. Luego crear `plan.md` y `tasks.md` usando [las plantillas](./_templates/spec.md). Los contratos se guardan junto a la capacidad o en una ubicación compartida indicada por el diseño, sin duplicar definiciones.

Cada especificación enumera datos y fronteras a diseñar; esto no equivale a tener contratos ejecutables completos. Registrar enlaces a pruebas y evidencia únicamente después de que existan.

## Trazabilidad ejecutada

| Alcance | Diseño/contratos | Código y pruebas | Estado real |
| --- | --- | --- | --- |
| REQ-001-01/02/03; AC-001-01/02/03 parcial | [Plan 001](001-foundation/plan.md), [identidad](001-foundation/contracts/identity-v1.md) | [authorization.ts](../src/authorization.ts), [pruebas](../tests/authorization.test.ts) | Dominio verificado; API/caché/exportación pendientes |
| REQ-001-04; auditoría | Contrato identidad | Sin almacenamiento todavía | Diseño, implementación en incremento 1 |
| REQ-001-05; AC-001-04 | Alcance reservado al incremento 1 | Sin UI | Pendiente |
| REQ-007-03/05; AC-007-03/06 parcial | [Plan 007](007-offline-sync/plan.md), [contrato](007-offline-sync/contracts/sync-v1.md) | [contracts.ts](../src/contracts.ts), authorization.ts y sus pruebas | Política verificada; firma/custodia/reloj persistido pendientes |
| REQ-007-02/04; AC-007-02 parcial | Contrato sync v1 | [sync.ts](../src/sync.ts), [pruebas](../tests/sync.test.ts) | Validación de acuse; efecto único/persistencia/snapshots no implementados |
| AC-007-01/04/05 integrales | Protocolo de fallos diseñado | Sin SQLite/PostgreSQL/transporte/impresión | Pendiente de siguientes incrementos |

## Trazabilidad del incremento 1

| Alcance | Código | Prueba / estado |
| --- | --- | --- |
| REQ-001-01/02; AC-001-01/05/06/07 | src/server/app.ts, security.ts, permissions.ts | tests/integration/foundation.test.ts: bootstrap concurrente, permisos reales, revocación, sesiones, aislamiento y último dueño |
| REQ-001-01/04; AC-001-08/09 | migrations/001-foundation.sql, src/server/db.ts | Misma suite: migración repetible/checksum, rollback de auditoría, índices únicos y reinicio real de PostgreSQL |
| REQ-001-04 | app.ts y db.ts | Auditoría con alcance histórico, paginación y sin secretos; protección append-only probada |
| REQ-001-05; AC-001-04/10 | web/ | tests/e2e/foundation.spec.ts: flujo completo, temas, móvil, teclado, acceso de cajero y axe |
| REQ-001-02/03; AC-001-02/03 comerciales | Políticas previas conservadas | Catálogo/ventas/caché/exportación siguen pendientes, no simulados |
| REQ-007-03 | Contrato offline vigente | Login online no equivale a concesión POS firmada; queda para incremento 3 |
