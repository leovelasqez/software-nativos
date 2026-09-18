# Tareas — Migración y puesta en marcha, incremento 8

Estado: preparado. Las tareas que procesen información comercial, prueben hardware o cambien la operación requieren las entradas y autorizaciones indicadas en `plan-increment-8.md`.

| ID | Entregable concreto | Requisitos / escenarios | Depende de | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- |
| TASK-INC8-01 | Registrar manifiesto de las fuentes y validador de preparación | REQ-011-01; AC-011-01 | MIG-01 | Cobertura, hash y filas rechazadas sin modificar originales | Parcial — fuentes locales inventariadas en `docs/evidence/increment-8-preflight.md`; contrato de extracción en `contracts/alegra-history-extract-v1.md`; falta la exportación histórica para MIG-01. |
| TASK-INC8-02 | Diseñar y verificar mapeo e importación idempotente en destino aislado | REQ-011-01/02/03; AC-011-01/02 | MIG-01, MIG-02 | Reintento sin duplicados, historia de consulta sin efectos comerciales | Bloqueado por datos/mapeo aprobados |
| TASK-INC8-03 | Ejecutar conciliación inicial/final y registrar corte | REQ-011-02/03; AC-011-02/03 | TASK-INC8-02, MIG-03 | Totales/documentos por período y ausencias explícitas | Bloqueado por extracción final y fecha de corte |
| TASK-INC8-04 | Registrar conteos físicos e iniciales causales por local | REQ-011-03; AC-011-02 | OPS-01 | Conteo firmado, diferencias y movimientos independientes de historia | Bloqueado por conteo físico |
| TASK-INC8-05 | Ensayar recuperación de pérdida total en destino aislado | REQ-011-04; AC-011-04/06 | OPS-04 | Datos sincronizados conciliados y límites de pendientes IndexedDB documentados | Bloqueado por política externa de respaldo |
| TASK-INC8-06 | Ensayar impresión, comandas y cajón por local desde navegador | REQ-011-04; AC-011-07 | OPS-03 | Resultado T80A/Milán y T82E/Centro, online/offline, sin doble cobro | Preparado — protocolo en `docs/operations/hardware-acceptance.md`; ejecución bloqueada por hardware físico/controladores. |
| TASK-INC8-07 | Checklist fiscal, operativo y arranque conjunto | REQ-011-05; AC-011-05 | TASK-INC8-03 a 06, OPS-02, OPS-05 | Autorización y validación posterior por ambos locales | Bloqueado por decisiones/autoridad externa |
