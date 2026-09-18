# Tareas — API y MCP para agentes, incremento 7A

Estado: preparado. Ver `plan.md` y `spec.md`.

| ID | Entregable concreto | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-010-01 | Contratos versionados de credencial, consulta, importación y herramientas MCP | REQ-010-01/02/03/04; AC-010-01 a 04 | Plan 010 | Esquemas validados y errores trazados | Verificado — `agent-api-v1.json`, esquemas de importación y contrato MCP describen sólo rutas/herramientas autorizadas |
| TASK-010-02 | Persistencia de credenciales revocables y autenticación del principal `agent` | REQ-010-01/04; AC-010-01/04 | 01 | Migración, pruebas de rotación/revocación y auditoría sin secreto | Verificado — migración 012 y `agent-api.test.ts` |
| TASK-010-03 | Consultas paginadas y proyecciones autorizadas para catálogo, inventario y reportes | REQ-010-02/04; AC-010-01/04 | 01–02 | Integración de alcance Centro, costos denegados y sincronización visible | Verificado — catálogo, recetas activas, inventario, movimientos e informes se consultan con alcance de sucursal y sin costos |
| TASK-010-04 | Vista previa y confirmación atómica/idempotente de lotes | REQ-010-03/04; AC-010-02/03 | 01–02 | Errores por fila, rollback total, reintento y conflicto comprobados | Verificado — inventario y catálogo/recetas validan por fila, confirman atómicamente, conservan recibos inmutables y cubren reintento/conflicto en integración |
| TASK-010-05 | Adaptador MCP sobre las operaciones autorizadas | REQ-010-02/04; AC-010-01/04 | 02–04 | Pruebas de herramientas y equivalencia de permisos con API | Verificado — JSON-RPC `initialize`/`tools/list`/`tools/call` delega sólo a operaciones autorizadas; integración cubre lectura y rechazo de importación para agente de sólo lectura |
| TASK-010-06 | Validación integral y evidencia del incremento | REQ-010-01 a 04; AC-010-01 a 04 | 02–05 | Dominio, integración, contrato y ejecución MCP documentados | Verificado localmente — evidencia en `docs/evidence/increment-7.md`; integración serial 55/55 y E2E Edge 1/1, además de unitarios (33), typecheck, build y diff-check. |
