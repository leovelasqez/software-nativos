# Tareas 001 — Incremento 0

| ID | Entregable | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-001-01 | Contrato de identidad, alcance, permisos y auditoría | REQ-001-01/02/04; AC-001-01/02/03 parcial | DEC-001/004 | Esquema validado | Completada |
| TASK-001-02 | Política de acceso y proyección pública sin costos | REQ-001-02/03; AC-001-01/02/03 parcial | TASK-001-01 | Pruebas de dominio | Completada |
| TASK-001-03 | Trazabilidad, verificación y estado documental | REQ-001-01/02/03/04 | TASK-001-02; TASK-007-02 | Registro reproducible | Completada |

La tabla del incremento 0 no acredita servidor/UI. Su implementación se registra abajo en incremento 1.

Evidencia: [incremento 0](../../docs/evidence/increment-0.md). Pruebas y diseño únicamente donde se indica alcance parcial.

## Incremento 1

| ID | Entregable | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-001-04 | OpenAPI, contratos y decisión de runtime/persistencia local | REQ-001-01/02/04; AC-001-05/06/07/08/09 | Incremento 0 | Contrato cerrado | Completada |
| TASK-001-05 | Migración PostgreSQL y arranque local aislado | REQ-001-01/04; AC-001-05/08/09 | TASK-001-04 | Migración repetible, rollback y reinicio | Completada |
| TASK-001-06 | Bootstrap/login/sesiones y permisos en API | REQ-001-01/02; AC-001-01/05/06/07 | TASK-001-05 | Integración sin fugas, CSRF y revocación | Completada |
| TASK-001-07 | Usuarios/roles, sucursales/bodegas/equipos y auditoría atómica | REQ-001-01/02/04; AC-001-07/08/09 | TASK-001-06 | API y transacciones comprobadas | Completada |
| TASK-001-08 | Interfaz React accesible, formularios y temas | REQ-001-05; AC-001-04/10 | TASK-001-07 | E2E escritorio/móvil y capturas | Completada |
| TASK-001-09 | Evidencia, README, matriz y cierre | REQ-001-01/02/04/05 | TASK-001-08 | Comandos reproducibles y límites | Completada |

TASK-001-04 a 09: [evidencia del incremento 1](../../docs/evidence/increment-1.md), código y pruebas relacionados en ese registro.
