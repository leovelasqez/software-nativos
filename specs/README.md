# Índice de especificaciones y trazabilidad

## Rediseño 017 — implementado y verificado localmente

Propuesta visual aprobada el 19-09-2026 para todo el sitio, con Resumen operativo por sucursal. [Spec](017-visual-redesign/spec.md), [plan](017-visual-redesign/plan.md), [tareas](017-visual-redesign/tasks.md), [contrato](../contracts/dashboard-v1.md) y [evidencia](../docs/evidence/visual-redesign.md). Sitio real verificado con datos sintéticos, 45 pruebas unitarias, 58 de integración, regresión E2E y revisión visual de los 15 módulos. Sin publicación.

**Dirección vigente: sitio web único (DEC-021, 15-09-2026).** Administración y Caja comparten origen; Caja conserva siete días offline en navegador. La transición se traza en [012](012-unified-web/spec.md). Las tablas 0–5 son evidencia histórica y no deben interpretarse como decisión de continuar Electron.

Implementación local autorizada el 13-09-2026. **Incrementos 0–5 verificados en sus alcances**: fundamentos, catálogo/recetas/existencias, caja local y operación de pedidos/clientes/división/devolución. [Evidencia 5](../docs/evidence/increment-5.md). Las tablas históricas siguientes describen lo comprobado en cada incremento; no se acreditan aún las especificaciones completas de pedidos, compras, fidelización, integraciones, hardware o lanzamiento. Nada está publicado en producción.

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
| [012](./012-unified-web/spec.md) | Sitio web único y transición | 1, 7, 14, 16–17 | REQ-012-01 a 05 |
| [011](./011-migration-release/spec.md) | Migración, respaldo y puesta en marcha | 14–17 | REQ-011-01 a REQ-011-06 |
| [015](./015-caja-branch-profiles/spec.md) | Perfiles de Caja por sucursal y comprobante térmico | Mantenimiento 18-09-2026 | REQ-015-01 a REQ-015-04 |

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

## Trazabilidad del incremento 2

| Alcance | Diseño/código | Prueba / estado |
| --- | --- | --- |
| REQ-002-01/02/05; AC-002-05/06 | planes/tasks 002/003, contracts/catalog-inventory-v1.json, src/server/catalog-api.ts | tests/integration/catalog.test.ts: alta por cajero, impuesto null/0, edición optimista e historia; E2E administrativo |
| REQ-002-03/04/05; AC-002-02/07 | src/catalog.ts, recipe_versions, web/Catalog.tsx | tests/catalog.test.ts: conversiones/sustituciones/adicionales; integración y E2E borrador/activación/versiones |
| REQ-003-01/02 parcial; AC-003-01/06 | migrations/002-catalog-inventory.sql, catalog-api.ts | Inicial exacto, reintento concurrente, reversión única, mínimo y paginación en PostgreSQL; flujo E2E |
| REQ-003-05 parcial; AC-003-07 | Endpoints de costo separados, dominio recipeCost | Dueño consulta costo base; encargado/cajero 403; null distinto de cero. Promedio ponderado pendiente |
| REQ-001-04; AC-003-08 | Transacción/idempotencia/auditoría y tablas inmutables | Rollback de producto y saldo, reinicio PostgreSQL y snapshot lógico restaurado en base sintética |
| REQ-001-05 | Catálogo/recetas/inventario React | E2E: temas, móvil, teclado, formularios, axe y capturas revisadas |

AC-002-01/03/04/05 integrales de pedido/cobro y AC-003-02/03/04/05 integrales de ventas/compras/márgenes siguen pendientes. No atribuir a incremento 2 operación offline, cobros, promedios, importación ni respaldo operativo.


## Trazabilidad del incremento 3

| Alcance | Diseño/código | Verificación |
| --- | --- | --- |
| AC-004-11/12, AC-006-05 | Planes/tareas 004/006/007, DEC-018, contracts/pos-*, src/pos-domain.ts | Cálculo exacto, impuesto ausente/0/asignado, efectivo/digital, receta y versión por línea |
| AC-007-07; REQ-007-01/02/04 | src/pos/store.ts, src/server/pos-api.ts, migración 003 | SQLite y PostgreSQL reales: rollback, reinicio, pérdida de acuse, idempotencia, hash/secuencia/identidad y consumo único |
| AC-007-03/06/07 | src/pos/engine.ts, vault.ts, pos-crypto.ts | Firma Ed25519, DPAPI sin secretos en SQLite, expiración/reloj, revocación y pendientes preservados |
| AC-006-05 | Turnos locales/centrales y registro de efectivo | Responsable único, base+efectivo sin digitales; contado/diferencia; cierre y copia tras reinicio |
| REQ-001-05, AC-004-12 | web/Pos.tsx, desktop/main.cjs | E2E Edge/Electron, temas/móvil/teclado, axe y capturas |

Evidencia detallada: [incremento 3](../docs/evidence/increment-3.md). No cubre notificación de cierre de AC-006-04, hardware de AC-007-05, recuperación ante disco perdido ni el resto de operaciones de 004/006.


## Trazabilidad del incremento 4

| Alcance | Contrato e implementación | Evidencia |
| --- | --- | --- |
| AC-004-01/02/03/04/08/09/10 | Pedidos v2, opciones/notas/descuentos, comanda, cancelación preparada, división y medios combinados | Dominio, integración y E2E |
| REQ-005-01; AC-005-01 parcial | Cliente único online, selección cacheada e historia sincronizada por sucursal | Duplicados, permisos, preservación de pedido y navegador |
| REQ-005-02 parcial | Datos/estado manuales del domicilio pendiente | E2E de dirección/envío/mesa; sin seguimiento posterior al cierre |
| REQ-004-05/06 sin puntos | Comprobante inmutable y devoluciones acumuladas por productos, propina y domicilio | Reintento, recuperación y restitución exacta; cajero denegado |
| REQ-006-02/03 parcial | Cobro y devolución atómicos, efectivo aplicado y propina/domicilio netos del turno | Cierre local/central conciliado |
| REQ-007-01/02/03 | Outbox causal v1/v2, checksum/migración, rollback, reinicio y concesiones | SQLite/PostgreSQL/DPAPI reales; acuse perdido |
| REQ-001-05 | Formularios y navegación en escritorio/móvil, claro/oscuro | Edge/Electron, axe, teclado y capturas revisadas |

[Evidencia](../docs/evidence/increment-4.md). Fidelización, movimientos manuales de caja, compras, respaldo, impresión física y las especificaciones integrales permanecen en sus incrementos.

## Trazabilidad del incremento 5

| Alcance | Diseño/implementación | Verificación |
| --- | --- | --- |
| AC-005-01/05; REQ-005-03/06 | loyalty-v1, loyalty-api, migración 005, web/Loyalty | Inscripción única, ajustes/reglas solo dueño, auditoría e idempotencia; integración y navegador |
| AC-005-02/07/08; AC-004-06/07 | loyalty.ts, orders-domain.ts, comprobante v3 | Cálculo exacto, propina antes del canje, devolución proporcional, redondeos y restitución completa; dominio/integración |
| AC-005-03/04/06; REQ-007-01/02 | loyalty-store, engine, orders-sync, pos-api | Offline/reinicio, canjes concurrentes, pérdida de acuse, cancelación antes/después del commit y saldo negativo; motores reales |
| REQ-005-06 | Reglas inmutables y caché versionada | Ventas anteriores y offline conservan su regla; sin puntos retroactivos |
| REQ-001-05 | Administración y controles de caja | Edge/Electron, escritorio/móvil, temas, teclado, axe y capturas |

[Evidencia del incremento 5](../docs/evidence/increment-5.md). AC-005-01 a 08 cubiertos en este alcance. Excel de REQ-005-06 queda en 008/incremento 6; no se declara verificada la especificación completa de domicilios ni el lanzamiento operativo.

## Trazabilidad de la transición web 5W

REQ-012-01 a 05 / AC-012-01 a 06: [plan](012-unified-web/plan.md), [contrato](../contracts/browser-pos-v1.md), web/offline, local-transition y pruebas de navegador/traslado. [Evidencia](../docs/evidence/unified-web.md). Adaptadores web verificados localmente; datos anteriores conservados y traslado disponible al perfil elegido. La autorización alinea un perfil vacío con el cursor causal central y la interfaz recupera explícitamente una colisión de secuencia sin cambiar identidad, contenido ni hash de los pendientes. No acredita hardware ni publicación.

AC-012-07 / REQ-003-03: Caja reconoce únicamente el rechazo histórico de existencias insuficientes sobre un cobro y ofrece reintentar la misma envoltura. El servidor conserva la regla de saldo negativo con alerta. AC-006-06 alinea mediante migración aditiva los usuarios humanos anteriores con el permiso predeterminado `cash.movement`; ver [evidencia web](../docs/evidence/unified-web.md).

## Trazabilidad de mantenimiento 015

REQ-015-01 a 04 / AC-015-01 a 04: [spec](015-caja-branch-profiles/spec.md), [plan](015-caja-branch-profiles/plan.md), [tareas](015-caja-branch-profiles/tasks.md), [contrato de Caja](../contracts/browser-pos-v1.md) y [evidencia](../docs/evidence/caja-branch-profiles.md). Selector de terminal, aislamiento de perfiles, identificación de bodegas y formato térmico verificados localmente; la aceptación física de impresión sigue en 011.

## Mantenimiento 016 — Interfaz de Caja

REQ-016-01 a 07 / AC-016-01 a 07: [especificación](016-caja-ui/spec.md), [plan](016-caja-ui/plan.md) y [tareas](016-caja-ui/tasks.md). Cabecera compacta, catálogo filtrable, pedido visible, cobro progresivo y resumen exacto de pagos. Verificada localmente; [evidencia y capturas](../docs/evidence/caja-ui.md).
