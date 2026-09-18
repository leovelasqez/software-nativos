# Contrato v1 — Intenciones de notificación

Estado: contrato local para REQ-009-01 a 04. No contiene una cuenta de WhatsApp ni autoriza envío externo.

## Intención

Una intención tiene contenido causal inmutable y estado transaccional (`{id, dedupeKey, type, branchId, causalId, recipientRole, state, payload, createdAt}`). `type` es `low_stock_daily` o `shift_closed`; `recipientRole` es `owner` o `branch_manager`; `state` inicia como `pending`.

`dedupeKey` es único. Para mínimos: `low-stock:{branchId}:{America/Bogota YYYY-MM-DD}:{recipientRole}`. Para cierre: `shift-closed:{shiftId}:{recipientRole}`. La misma clave nunca crea un segundo mensaje, incluso después de reinicio o reintento de sincronización.

El payload de mínimos tiene filas `{warehouseId, warehouseName, itemId, itemName, reference, baseUnit, quantity, minimum}` con `quantity <= minimum`; filas fuera de mínimo se excluyen al materializar. El payload de cierre incluye `{shiftId, branchId, cashierName, openedAt, closedAt, openingCash, salesByMethod, income, expenses, withdrawals, refunds, expected, counted, difference, tips, shipping, reportPath}`. `reportPath` es una ruta relativa autenticada y no incorpora token.

## Estados e intentos

Estados permitidos: `pending → sending → delivered`; `sending → failed_retryable | failed_terminal | uncertain`; `failed_retryable → sending`; `uncertain` no transiciona automáticamente. Cada intento añade `{id, intentId, startedAt, finishedAt, outcome, providerMessageId|null, safeError|null}`. `outcome` es `delivered`, `retryable`, `terminal` o `uncertain`. No se registran cuerpo de solicitud, teléfono, bearer token, plantilla ni respuesta completa del proveedor.

## Operaciones locales

`GET /api/notifications?branchId=&state=&after=&limit=` devuelve una proyección paginada al dueño, con payload comercial y estado, sin datos de contacto. `POST /api/notifications/:id/simulate` sólo existe localmente y permite registrar un resultado sintético de prueba; requiere `settings.manage`, `operationId` y motivo. No hay endpoint de URL arbitraria, teléfono o proveedor.

Las mutaciones de inventario y cierre sólo llaman al creador de intención dentro de su propia transacción. Un fallo de persistencia revierte el hecho comercial. El adaptador externo futuro toma una intención ya confirmada; su fallo no revierte venta, saldo ni cierre.
