# Plan técnico de 021

Estado: verificado localmente. Referencia: [spec.md](spec.md) y [evidencia](../../docs/evidence/state-machines-2026-11-09.md).

## Incremento seleccionado

REQ-021-01 a 05 / AC-021-01 a 05, autorizado por la solicitud actual del usuario. Trabajar en `software-nativos`; los otros worktrees conservan sus ramas y cambios.

Durante la publicación se añade REQ/AC-021-06: generación determinista del manifiesto offline, al detectar en staging la diferencia de orden de archivos entre Windows y Linux. La única modificación funcional adicional es ordenar la lista de recursos antes de generar `sw.js`; se prueba el script real y no se cambia su conjunto de rutas ni la política de actualización.

## Diseño

1. Inventario JSON en `docs/state-machines.json`, informe con alcance y prioridades en `docs/state-machines.md`, comando `scripts/audit-state-machines.ts`. Las referencias apuntan a código y pruebas; las proyecciones derivadas no se presentan como nuevos estados persistidos.
2. Controlador puro `src/async-operation.ts` con instantánea discriminada y exclusión sincrónica. Adaptación React mediante `useSyncExternalStore` en `web/useAsyncOperation.ts`; integrar en `SaveForm` y `CatalogImport`.
3. Unión y transiciones puras para la etapa de importación, conservando el resultado confirmado si falla el refresco. Reintentar únicamente `saved()` y mantener el ID central.
4. Dominio `src/notification-state.ts`: lista, tipo, etiquetas y transiciones según origen del evento. Reusar en entrega, filtro API e interfaz. SQL, scheduler, límites de reintento y firma de webhooks permanecen compatibles.

## Contratos

Sin cambios de API ni esquema de almacenamiento. Precisar las transiciones de notificaciones en `contracts/notifications-v2.md`; documentar el contrato del controlador junto al código y el alcance observacional del inventario.

## Migración y recuperación

No hay migraciones ni cambios de IndexedDB, outbox, concesiones, comprobantes ni eventos históricos. Los estados nuevos de UI viven sólo en memoria. Una importación incierta mantiene la misma vista previa para el reintento idempotente existente; una ya confirmada no se vuelve a importar para refrescar la lista.

## Pruebas y operación

Referencia inicial: `npm run check`. Probar exclusión en el mismo turno JS, rechazo/recuperación y errores no convencionales; transiciones de importación confirmada; matrices de transporte/webhook y carrera real en integración. Añadir regresión E2E de formulario e importación con datos sintéticos; comprobar escritorio/móvil, temas y teclado usando la suite existente. Ejecutar `npm run check`, `npm run audit:states` y `npm run test:e2e`, sin suites E2E simultáneas (puerto 4320).

## Riesgos abiertos

Publicación autorizada el 09-11-2026. La base auditada incluye el incremento de WhatsApp en staging; producción contiene correcciones posteriores de acceso a Caja (`db5a7b8`). Integrar ambas líneas en una rama de entrega aislada, actualizar el inventario de acceso y su escenario E2E, y volver a verificar el paquete combinado. El despliegue conserva la configuración externa de ambos entornos y no activa mensajes reales. La migración aditiva 024 pertenece al incremento previo de WhatsApp, no a las máquinas de UI; comprobar compatibilidad y salud sin modificar libros comerciales.

El inventario está ligado al árbol inspeccionado, no demuestra ausencia matemática de futuros flujos implícitos. No convertir cada campo de formulario en una máquina independiente. Documentar dónde siguen vigentes guardas distribuidas y qué pruebas las protegen; no cambiar reglas de cobro/sincronización por uniformidad estética.
