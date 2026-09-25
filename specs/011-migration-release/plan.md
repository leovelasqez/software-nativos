# Plan técnico — Respaldo y recuperación, incremento 6

Estado: implementación local verificada; política operativa externa pendiente. Esta fase no autoriza migrar Alegra, publicar ni realizar una restauración sobre datos comerciales.

## Incremento seleccionado

Respaldo lógico local del servidor PostgreSQL, retención configurable pendiente de operación, verificación de integridad y restauración ensayable únicamente en una base sintética aislada. El respaldo cubre solo hechos ya sincronizados al servidor. No se presenta IndexedDB, una copia del mismo disco ni una venta sin acuse central como protegida contra pérdida total del equipo.

## Diseño y contrato

Un propietario inicia manualmente un respaldo local y consulta sus manifiestos; la aplicación crea un artefacto lógico con versión de esquema, checksum SHA-256, instante, tamaño y cobertura. Restaurar siempre requiere una base destino vacía y aislada, una confirmación explícita y un manifiesto íntegro; jamás sustituye la base activa. Cada acción queda auditada. `contracts/backup-v1.md` delimita manifiesto, estado y errores; credenciales, contenidos de operaciones y secretos no se devuelven en la lista.

La política definitiva de ubicación externa, retención, RPO/RTO y presupuesto permanece en DEC-012. Hasta resolverla, no se programa borrado automático ni se promete recuperación ante pérdida de disco. Las exportaciones de evidencia usan datos sintéticos.

## Pruebas y riesgos

Ensayar crear → verificar → restaurar una base sintética recién migrada → conciliar conteos y hashes; rechazo de manifiesto alterado y de destino no vacío; permisos de dueño; y evidencia de qué operaciones offline no se recuperan. El hardware y migración real pertenecen a incremento 8.

## Correcciones de aceptación — 25-09-2026

NAT-UAT-01 / REQ-011-04 / AC-011-04/06: tomar una instantánea transaccional coherente; incluir conciliaciones de costos; restaurar tablas en orden de dependencias y movimientos al final, preservando referencias y contrapartidas. Reemplazar solo las semillas de una base recién creada dentro de una transacción; mantener restricciones de integridad. Conciliar conteos y contenido, no solo conteos. Un respaldo que omite tablas requeridas se rechaza como incompleto. Un error revierte la carga del destino aislado y lo conserva para diagnóstico; nunca borra o reemplaza una base existente. Repetir con operaciones comerciales sintéticas y comprobar que la base activa sigue igual.

## Publicación autorizada — 25-09-2026

Después de aprobar la validación local, el usuario solicita commit, push y despliegue en Railway. Publicar la versión probada desde `main` en `nativos-web` / `production`, conservando base, variables y volumen existentes. Comprobar el estado `SUCCESS`, `/health`, Administración y Caja; contrastar la versión desplegada con Git y los recursos publicados. Esta entrega no incorpora migraciones nuevas ni datos sintéticos a producción. Las evidencias locales de corrección conservan su fecha y alcance originales.
