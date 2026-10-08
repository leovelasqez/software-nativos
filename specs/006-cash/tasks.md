# Tareas — Incremento 3

## Comprobante de cierre — 07-10-2026

| ID | Entregable de revisión previa | Aceptación | Estado |
| --- | --- | --- | --- |
| TASK-006-PREVIEW-01 | Cálculo compartido y contrato de proyección de turno abierto | AC-006-10/11 | Verificado localmente |
| TASK-006-PREVIEW-02 | Consulta e impresión desde Turno sin operación de cierre | AC-006-10 | Verificado localmente |
| TASK-006-PREVIEW-03 | Dominio, integración del libro y E2E offline/compartido con evidencia | AC-006-10/11 | Verificado localmente |

| ID | Entregable | Aceptación | Estado |
| --- | --- | --- | --- |
| TASK-006-RECEIPT-01 | Contrato y cálculo exacto por medio, detalle completo y contrapartidas | AC-006-07/09 | Verificado localmente |
| TASK-006-RECEIPT-02 | Persistencia atómica, reconstrucción de cierres y reintento idempotente | AC-006-08/09 | Verificado localmente |
| TASK-006-RECEIPT-03 | Vista automática, consulta y formato imprimible | AC-006-07/08 | Verificado localmente |
| TASK-006-RECEIPT-04 | Pruebas de dominio, E2E y evidencia visual | AC-006-07/08/09 | Verificado localmente |

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
