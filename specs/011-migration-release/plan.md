# Plan técnico — Respaldo y recuperación, incremento 6

Estado: implementación local verificada; política operativa externa pendiente. Esta fase no autoriza migrar Alegra, publicar ni realizar una restauración sobre datos comerciales.

## Incremento seleccionado

Respaldo lógico local del servidor PostgreSQL, retención configurable pendiente de operación, verificación de integridad y restauración ensayable únicamente en una base sintética aislada. El respaldo cubre solo hechos ya sincronizados al servidor. No se presenta IndexedDB, una copia del mismo disco ni una venta sin acuse central como protegida contra pérdida total del equipo.

## Diseño y contrato

Un propietario inicia manualmente un respaldo local y consulta sus manifiestos; la aplicación crea un artefacto lógico con versión de esquema, checksum SHA-256, instante, tamaño y cobertura. Restaurar siempre requiere una base destino vacía y aislada, una confirmación explícita y un manifiesto íntegro; jamás sustituye la base activa. Cada acción queda auditada. `contracts/backup-v1.md` delimita manifiesto, estado y errores; credenciales, contenidos de operaciones y secretos no se devuelven en la lista.

La política definitiva de ubicación externa, retención, RPO/RTO y presupuesto permanece en DEC-012. Hasta resolverla, no se programa borrado automático ni se promete recuperación ante pérdida de disco. Las exportaciones de evidencia usan datos sintéticos.

## Pruebas y riesgos

Ensayar crear → verificar → restaurar una base sintética recién migrada → conciliar conteos y hashes; rechazo de manifiesto alterado y de destino no vacío; permisos de dueño; y evidencia de qué operaciones offline no se recuperan. El hardware y migración real pertenecen a incremento 8.
