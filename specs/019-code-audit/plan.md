# Plan técnico de 019

Estado: implementado y verificado localmente. Referencia: `spec.md`.

## Incremento seleccionado

REQ-019-01 a 09 / AC-019-01 a 09. Auditoría integral autorizada el 09-10-2026. Los ejes Standards y Spec se investigan por separado con la habilidad code-review, adaptada al árbol completo solicitado por el usuario. No se modifica producción ni datos comerciales.

## Diseño

Actualizar Fastify al parche corregido y resolver transitivas vulnerables dentro de sus rangos. Para bootstrap, `productionConfig` lee una clave opcional de instalación externa; `createApp` exige esa clave en orígenes que no sean loopback HTTP. Compararla mediante hashes de longitud fija y `timingSafeEqual`, antes de adquirir el lock o derivar contraseñas. Incorporar un campo condicionado a la configuración inicial en el formulario; no almacenar la clave en el navegador.

El motor offline reúne los movimientos de su libro compartido y eventos locales para detectar una contrapartida existente antes de mutar el agregado. La interfaz usa el mismo estado para retirar la acción. Conservar el reintento idempotente antes de esta guardia. La auditoría utiliza `actor.user.kind` como parámetro SQL.

Extraer al dominio `cashMovementDelta` y `canCorrectCashMovement` para compartir la validación entre motor e interfaz. Reusar `isWithinGrantClock` al verificar versiones/timestamps, manteniendo cinco segundos. `/pos/authorize` agrega `closedShiftIds` limitado al equipo y su instalación original/continuaciones. Sin pendientes ni canje incierto, IndexedDB conserva marcas de cierre y `shift()` excluye esas marcas sin inventar conteo, diferencias ni fechas. El libro completo continúa limitado al responsable.

Reutilizar la precisión decimal del dominio en informes y validar límites/cursores antes de consultar. Notificaciones usan identificadores completos como cursor; inventario de agentes admite exclusivamente el formato compuesto que produce la ruta. Retirar importaciones/variables sin uso confirmado y activar chequeos de TypeScript para evitar su reintroducción. El service worker limpia solo caches `nativos-shell-` distintos del actual durante activación, conservando la espera normal de versiones y sin tocar IndexedDB.

Compras admite equivalencias entre códigos de venta y textos históricos, conservando el registro original; su fecha utiliza el helper de Bogotá ya usado en Resumen. Fidelización consulta el libro por sucursal/fecha del propio movimiento, incluyendo ajustes sin venta. Agentes excluyen archivados de sus proyecciones operativas. La reversión de iniciales acepta tanto `initial` como `import_initial`, con la misma causalidad/idempotencia. Excel elimina caracteres que XML 1.0 no admite, preserva Unicode válido y serializa contenido de usuario como texto.

Antes de aceptar un grant, verificar que conserva el actor firmado previo cuando reutiliza el verificador local. El login y setup devuelven el actor autenticado para vincular contraseña y grant incluso si otra pestaña cambia la cookie entre solicitudes. La recuperación por cookie comprueba el login e ID de `/me`; conserva un verificador solo para ese actor. Los estados previos siguen usando su concesión firmada y el alta sin caja conserva un ID opcional hasta la primera concesión. Publicar la sesión local únicamente después de validar la identidad; permitir cambios de roles/permisos del mismo actor y login explícito de un usuario recreado.

## Contratos

Actualizar `contracts/foundation-api-v1.json` con clave opcional en `/api/setup` e indicador de protección en `/api/status`. Documentar la variable externa y el comportamiento cerrado por defecto. Precisar corrección local en `contracts/cash-movements-v1.md`, paginación en informes/agentes/notificaciones y limpieza en `contracts/browser-pos-v1.md`.

## Migración y recuperación

No se reescriben migraciones ni operaciones históricas. IndexedDB v1 incorpora un campo opcional de marcas de cierre, compatible con estados anteriores; se conserva el protocolo de sincronización. El cambio de auditoría afecta nuevos eventos; no modifica el libro inmutable existente. Sitios ya configurados mantienen login/sesiones. Una nueva instalación alojada requiere suministrar una clave externa antes de registrar el primer dueño.

## Pruebas y operación

Referencia inicial: tipos/dominio/integración/build existentes, `npm audit`, símbolos no usados. Añadir pruebas significativas del bootstrap alojado, actor de auditoría, importes grandes, consultas malformadas, cursores de segunda página, corrección repetida en navegador y activación de service worker. Ejecutar la suite completa y Edge E2E una sola vez tras cambios; repetir únicamente fallos o cambios que lo justifiquen. Registrar resultados reales, hallazgos y límites en `docs/evidence/code-audit-2026-10-09.md`.

## Riesgos abiertos

La clave de instalación se configura fuera del repositorio solo al preparar una base alojada nueva. No generarla ni publicarla en documentos. Compatibilidad Electron/SQLite y migraciones permanecen por su función histórica. Recuperación externa y hardware conservan sus decisiones operativas existentes.
