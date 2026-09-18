# Tareas — Notificaciones confirmadas, incremento 7B

Estado: lista para implementación local sin envío externo. Ver `plan.md` y `spec.md`.

| ID | Entregable concreto | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-009-01 | Contrato de intención, destinatario lógico, deduplicación y estado | REQ-009-01 a 04; AC-009-01 a 05 | DEC-010 | Contrato trazado sin números ni proveedor | Completado — `contracts/notifications-v1.md` |
| TASK-009-02 | Libro inmutable de intenciones/intentos y proyección protegida | REQ-009-02/03/04; AC-009-01/03/04 | 01 | Migración y pruebas PostgreSQL | Verificado — migración 015, lectura protegida, transición simulada idempotente, intentos append-only y auditoría pasan en PostgreSQL |
| TASK-009-03 | Generación de resumen de mínimos y cierre sincronizado | REQ-009-02/03; AC-009-01/02/03/05 | 02 | Agrupación, saldo actualizado e idempotencia | Verificado — proceso local de las 08:00 Colombia, clave diaria persistente, cierre deduplicable y reposición antes del corte cubiertos en `cash.test.ts` |
| TASK-009-04 | API/pantalla de dueño y simulador de resultados | REQ-009-01/04; AC-009-04 | 02–03 | Permisos, estados y auditoría | Verificado localmente — API/pantalla muestran cola y simulan entrega/incierto sin envío; integración cubre estado, auditoría y 403 de cajero; E2E de navegación está incorporado |
| TASK-009-05 | Adaptador WhatsApp y activación real | REQ-009-01/04; AC-009-04/05 | DEC-010/012 | Cuenta, plantillas, reconciliación y prueba operativa | Bloqueado — no configurar ni enviar sin datos/decisión externa |
| TASK-009-06 | Evidencia integral del incremento local | REQ-009-01 a 04; AC-009-01 a 05 | 02–04 | Dominio, integración, contrato y E2E | Verificado localmente — `test:integration` serial: 55/55; E2E en Edge: 1/1. Ver `docs/evidence/increment-7.md`. |
