# Recuperación de acceso guardado de Centro — 01-11-2026

AC-018-15. Continuación del despliegue autorizado en `nativos-web/production`, sobre el commit publicado `278a5f4` (despliegue `e85d4dfa-b52c-4335-90d0-aecf63d308fe`).

## Problema y corrección

La foto del equipo de Centro muestra el texto del cliente nuevo y el rechazo «El equipo no está autorizado». El acceso de un perfil guardado reutilizaba su token anterior sin revalidarlo; un token desactualizado, ausente o desactivado reproducía ese rechazo aunque el login fuese válido.

Al entrar con contraseña, el motor prepara de nuevo el perfil guardado antes de sincronizar. Si su token sigue vigente se conserva. Si ya no sirve, el servidor vuelve a validar usuario y contraseña contra el mismo actor de la cookie, sus permisos y el equipo activo; renueva solamente el token/estado de esa instalación y audita sin credenciales. Permanecen la instalación, los cursores y el libro comercial. Una cookie o identificador sin contraseña no permiten recuperar un token inválido.

Las operaciones retenidas por `device_auth`/`device_revoked` vuelven a reintento cuando cambia el token. Conservan su identificador, payload y firma; solo salen de la cola tras el acuse coincidente. Otros conflictos conservan su tratamiento anterior. Un fallo de entrada restaura el agregado previo. La contraseña no se guarda en IndexedDB ni en auditoría.

## Verificación

- TypeScript y compilación aprobados; 75 pruebas unitarias aprobadas. Registros en `.local/centro-revalidation-typecheck.log`, `centro-revalidation-build.log` y `centro-revalidation-all-unit.log`.
- 5 casos de la suite de integración de acceso aprobados contra PostgreSQL real. Incluyen tokens desactualizados, ausentes y desactivados; renovación con mismo cursor, turnos intactos y auditoría sin contraseñas. Contraseña incorrecta, cuenta distinta de la sesión, dispositivo inactivo y sucursal ajena continúan rechazados. Registro: `.local/centro-revalidation-integration.log`.
- Motor real: un perfil con token antiguo, usuario marcado revocado, turno abierto y operación retenida recupera el acceso y sincroniza exactamente la misma operación. Con contraseña incorrecta o recuperación por cookie se conserva íntegro el estado anterior. Registro: `.local/centro-revalidation-unit.log`.
- Navegador: el recorrido altera el token dentro del agregado cifrado de IndexedDB, vuelve a entrar como cajero y comprueba que el pedido de recuperación usa la instalación anterior y termina en Centro. La captura `test-results/login-terminals/revalidated-centro.png` se revisó visualmente. La regresión completa `foundation.spec.ts` pasó, 1/1, en 2,9 minutos, incluyendo ventas, turnos, offline y traslado histórico. Registro: `.local/centro-revalidation-e2e.log`.

## Publicación

Se publicará el commit que contiene esta evidencia, usando un archivo Git de las fuentes y configuración. Se comprobarán salud, estado de Railway y huellas de los recursos públicos. Los resultados de publicación se conservarán fuera de Git para identificar el mismo commit. Las verificaciones comerciales son sintéticas y aisladas; la comprobación de producción es de solo lectura.
