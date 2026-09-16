# Tareas — Informes y exportaciones, incremento 6

Estado: completado salvo costo/margen bloqueado por DEC-005. Ver `plan.md` y `spec.md`.

| ID | Entregable concreto | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-INC6-REP-01 | Contrato de filtros, totales y exportación | REQ-008-01/03/04; AC-008-01/03/04 | Plan | `contracts/reports-v1.*` | Diseño completado |
| TASK-INC6-REP-02 | Consultas autorizadas y antigüedad por sucursal | REQ-008-01/04; AC-008-02/03 | 01 | Dominio e integración PostgreSQL | Verificado — consultas por sucursal/período, cajero autorizado sin costos/márgenes y paginación 120/20 en `reports.test.ts` |
| TASK-INC6-REP-03 | Generador XLSX completo y descargable | REQ-008-03/04; AC-008-01/04 | 02 | Prueba 120/20 y archivo validado | Verificado — `reports.test.ts` valida XLSX 120/20 |
| TASK-INC6-REP-04 | Pantalla de informes y evidencia accesible | REQ-008-01/03/04 | 02–03 | E2E, temas, móvil, teclado | Verificado — E2E abre Informes y descarga el XLSX |
| TASK-INC6-REP-05 | Costos/margen promedio | REQ-008-02; AC-008-02/04 | DEC-005 | Decisión, pruebas y contrato ampliado | Bloqueado |
