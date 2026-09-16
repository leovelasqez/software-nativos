# Tareas — Respaldo y recuperación, incremento 6

Estado: completado en respaldo/restauración local; política externa bloqueada por DEC-012. Ver `plan.md` y `spec.md`.

| ID | Entregable concreto | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-INC6-BKP-01 | Contrato de manifiesto y límites de cobertura | REQ-011-04; AC-011-04/06 | Plan, DEC-012 | `contracts/backup-v1.md` | Diseño completado |
| TASK-INC6-BKP-02 | Servicio de creación/verificación local | REQ-011-04 | 01 | Pruebas de checksum y permisos | Verificado — creación, listado, SHA-256, auditoría y rechazo de alteración en `backup.test.ts` |
| TASK-INC6-BKP-03 | Restauración aislada y conciliación sintética | AC-011-04/06 | 02 | Base sintética restaurada | Verificado — confirmación explícita, destino nuevo, migración, restauración y conciliación en `backup.test.ts` |
| TASK-INC6-BKP-04 | Registro operativo y evidencia | REQ-011-04 | 02–03 | Evidencia y límites documentados | Verificado — pantalla de dueño, auditoría y evidencia de límites actualizada |
| TASK-INC6-BKP-05 | Retención/ubicación externa/RPO-RTO | REQ-011-04 | DEC-012 | Decisión operativa aprobada | Bloqueado |
