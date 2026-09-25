# Tareas — Incremento 2

Estado: completado en el alcance del incremento 2. Evidencia: ../../docs/evidence/increment-2.md.

| ID | Entregable | Requisitos / escenarios | Dependencia | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-INC2-01 | Contrato API y criterios acotados | REQ-002-01/05, REQ-003-01/02 | Plan | OpenAPI | Completado |
| TASK-INC2-02 | Dominio exacto y migración aditiva con versiones/libro | AC-002-02/06/07, AC-003-01/06 | 01 | Dominio, SQL | Completado |
| TASK-INC2-03 | API autenticada, idempotencia, costos separados y auditoría | AC-002-06/07, AC-003-06/07/08 | 02 | Integración PostgreSQL | Completado |
| TASK-INC2-04 | Formularios catálogo/recetas/existencias | AC-002-06, AC-003-06 | 03 | E2E, móvil, temas, teclado | Completado |
| TASK-INC2-05 | Verificar y documentar resultado/límites | Todos los anteriores | 04 | docs/evidence/increment-2.md | Completado |

## Incremento 6

| ID | Entregable concreto | Requisitos / escenarios | Dependencia | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-INC6-INV-01 | Contrato de proveedor, compra, traslado y conteo | REQ-003-01/02; AC-003-09/10/11 | Plan | `contracts/inventory-operations-v1.md` | Diseño completado |
| TASK-INC6-INV-02 | Migración aditiva y libro de operaciones | REQ-003-01/02/04 | 01 | Integración PostgreSQL | Verificado — compra, traslado, conteo y consumo interno cubiertos por integración PostgreSQL |
| TASK-INC6-INV-03 | API autorizada, idempotente y auditada | AC-003-09/10/11 | 02 | Pruebas de permisos/reintento | Verificado — permisos, reintentos y auditoría para AC-003-09/10/11 y consumo interno |
| TASK-INC6-INV-04 | Formularios de compras, traslados y conteos | REQ-003-02 | 03 | E2E, móvil, temas y teclado | Verificado — compra, traslado/despacho/recepción parcial, conteo y consumo interno E2E |
| TASK-INC6-INV-05 | Costeo promedio y valoración de salidas | REQ-003-05; AC-003-04 | DEC-005 | Decisión y pruebas de historia | Bloqueado |

- [x] TASK-UAT-INV-01 — Corregir NAT-UAT-02 y verificar compra, traslado completo, conteo y consumo de terminados (AC-003-09/10/11). Integración y navegador aprobados; [evidencia](../../docs/evidence/correccion-flujos-2026-09-25.md).
