# Tareas de 021

Estado: completado y verificado localmente. [Evidencia](../../docs/evidence/state-machines-2026-11-09.md).

| ID | Entregable | Requisitos / escenarios | Dependencia | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-021-01 | Inventario de estados, guardas, persistencia y referencias verificables | REQ-021-01/05 · AC-021-01 | Inspección | JSON, informe y comando de auditoría | Verificado |
| TASK-021-02 | Controlador de operación única y formularios protegidos | REQ-021-02 · AC-021-02 | TASK-021-01 | Pruebas de concurrencia y navegador | Verificado |
| TASK-021-03 | Importación confirmada independiente de su refresco | REQ-021-03 · AC-021-03 | TASK-021-02 | Transiciones y recuperación sin reconfirmar | Verificado |
| TASK-021-04 | Dominio de entrega compartido por API/UI/adaptador | REQ-021-04 · AC-021-04 | TASK-021-01 | Matriz y carreras con PostgreSQL | Verificado |
| TASK-021-05 | Regresión completa y evidencia con límites reales | Todos · AC-021-05 | TASK-021-02/03/04 | Check, auditoría y E2E | Verificado |
| TASK-021-06 | Manifiesto offline reproducible y entrega por commit exacto | REQ-021-06 · AC-021-06 | TASK-021-05 | Prueba del script real y huellas alojadas en el registro externo de publicación | Verificado localmente; publicación en registro externo |
