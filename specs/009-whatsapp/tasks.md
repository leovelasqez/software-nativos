# Tareas — Notificaciones confirmadas, incremento 7B

## Incremento de dueño autorizado — 15-10-2026

| ID | Entregable concreto | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-009-07 | Especificación vigente, contrato v2 y decisiones de dueño/staging | REQ-009-05 a 08 / AC-009-05 a 11 | Instrucción del usuario | Documentación consistente | Completada |
| TASK-009-08 | Instantáneas consolidadas y comprobante compartido, migración aditiva | REQ-009-02/03/05 / AC-009-05/06/07 | 07 | Dominio y PostgreSQL | Verificada — incluye corte vacío y muestra manual independiente |
| TASK-009-09 | Adaptador desactivado, despachador durable y webhook firmado | REQ-009-07/08 / AC-009-09/10 | 08 | Transporte sintético, timeout, concurrencia y recuperación | Verificada con transporte sintético; activación real pendiente |
| TASK-009-10 | Pantalla WhatsApp, enlace autenticado, Excel y prueba sin envío | REQ-009-06/08 / AC-009-08/11 | 08–09 | API y navegador en ambos temas/tamaños | Verificada localmente — E2E, permisos, descarga y accesibilidad |
| TASK-009-11 | Verificación, guía de configuración y despliegue sólo staging | Todos / AC-009-11 | 08–10 | Check, E2E y publicación identificable | Verificación local completa; publicación en curso |

## Tareas históricas

Estado: lista para implementación local sin envío externo. Ver `plan.md` y `spec.md`.

| ID | Entregable concreto | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-009-01 | Contrato de intención, destinatario lógico, deduplicación y estado | REQ-009-01 a 04; AC-009-01 a 05 | DEC-010 | Contrato trazado sin números ni proveedor | Completado — `contracts/notifications-v1.md` |
| TASK-009-02 | Libro inmutable de intenciones/intentos y proyección protegida | REQ-009-02/03/04; AC-009-01/03/04 | 01 | Migración y pruebas PostgreSQL | Verificado — migración 015, lectura protegida, transición simulada idempotente, intentos append-only y auditoría pasan en PostgreSQL |
| TASK-009-03 | Generación de resumen de mínimos y cierre sincronizado | REQ-009-02/03; AC-009-01/02/03/05 | 02 | Agrupación, saldo actualizado e idempotencia | Verificado — proceso local de las 08:00 Colombia, clave diaria persistente, cierre deduplicable y reposición antes del corte cubiertos en `cash.test.ts` |
| TASK-009-04 | API/pantalla de dueño y simulador de resultados | REQ-009-01/04; AC-009-04 | 02–03 | Permisos, estados y auditoría | Verificado localmente — API/pantalla muestran cola y simulan entrega/incierto sin envío; integración cubre estado, auditoría y 403 de cajero; E2E de navegación está incorporado |
| TASK-009-05 | Adaptador WhatsApp y activación real | REQ-009-01/04; AC-009-04/05 | DEC-010/012 | Cuenta, plantillas, reconciliación y prueba operativa | Adaptador resuelto en TASK-009-09; activación real pendiente de cuenta y autorización operativa |
| TASK-009-06 | Evidencia integral del incremento local | REQ-009-01 a 04; AC-009-01 a 05 | 02–04 | Dominio, integración, contrato y E2E | Verificado localmente — `test:integration` serial: 55/55; E2E en Edge: 1/1. Ver `docs/evidence/increment-7.md`. |
