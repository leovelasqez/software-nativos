# Contrato v1 — Respaldo y restauración local (incremento 6)

Estado: implementación local verificada. No es una política de respaldo externo ni cobertura de datos sin sincronizar.

Un manifiesto contiene `version`, `id`, `createdAt`, `schemaVersion`, `sha256`, `bytes`, `coverage: "server-synchronized-only"` y estado `verified`. La lista no incluye secretos ni datos del respaldo. Solo dueño con `settings.manage` puede crear, verificar o ensayar una restauración.

`POST /api/backups` crea artefacto lógico y manifiesto. `GET /api/backups` lista manifiestos. `POST /api/backups/{id}/verify` recalcula hash. `POST /api/backups/{id}/restore-check` exige la confirmación exacta `RESTORE {id}`, crea exclusivamente una base sintética configurada y ausente, restaura y devuelve conciliación; rechaza destino activo o cualquier destino ya existente. Todas las rutas registran auditoría y devuelven 409 si el estado del manifiesto no permite la operación.

Una operación local de Caja sin acuse central, IndexedDB y una copia en el mismo disco quedan fuera de cobertura. Retención, ubicación externa, RPO y RTO requieren DEC-012.
