# Tareas — Incremento 3

| ID | Entregable | Requisitos / aceptación | Estado |
| --- | --- | --- | --- |
| TASK-INC3-01 | Contratos de cobro/turno/grant/sync y DEC-018 | AC-004-11/12, AC-006-05, AC-007-07 | Verificado |
| TASK-INC3-02 | Cálculo exacto y comprobante | REQ-004-05; AC-004-11/12 | Verificado |
| TASK-INC3-03 | Grant firmado, enrolamiento y commit central idempotente | REQ-007-02/03/04; AC-007-02/03/07 | Verificado |
| TASK-INC3-04 | SQLite/DPAPI, pedido/turno/cobro/outbox, reloj y reconexión | AC-007-01/03/06/07; AC-006-05 | Verificado |
| TASK-INC3-05 | UI caja, Electron y arranque local persistente | AC-004-12, REQ-001-05 | Verificado |
| TASK-INC3-06 | Pruebas fallos/permisos/E2E y evidencia | Todos los anteriores | Verificado |

## Incremento 6

| ID | Entregable concreto | Requisitos / aceptación | Estado |
| --- | --- | --- | --- |
| TASK-INC6-CASH-01 | Contrato de movimientos manuales y cierre consultable | REQ-006-02/03; AC-006-02/03 | Completado — `contracts/cash-movements-v1.md` |
| TASK-INC6-CASH-02 | Libro inmutable, permisos e idempotencia | REQ-006-01/02/03 | Completado — migración 010 e integración PostgreSQL |
| TASK-INC6-CASH-03 | Formulario y cierre consistente con informes | AC-006-02/03 | Completado — Caja web e informe de caja conectados en el incremento |
| TASK-INC6-CASH-04 | Integración, E2E y evidencia | REQ-006-04 | Verificado — integración PostgreSQL y regresión E2E conjunta |
| TASK-INC6-CASH-05 | Alinear usuarios humanos anteriores con el permiso predeterminado de movimientos | AC-006-06; REQ-006-02 | Verificado localmente — migración 019 y formulario habilitado en Caja de desarrollo |

Evidencia: [incremento 3](../../docs/evidence/increment-3.md). Alcance parcial de cada especificación, según hoja de ruta.
