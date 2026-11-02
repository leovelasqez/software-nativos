# Acceso online por usuario y contraseña — AC-018-16

## Alcance

El usuario reitera que la única credencial de acceso debe ser usuario y contraseña. La captura adjunta muestra el texto de un cliente anterior. La comprobación HTTP de producción confirmó el despliegue `d9335bf` y sus archivos actuales; el problema de una pestaña antigua se trata junto con la eliminación de la autorización independiente del navegador.

La continuación está autorizada para `nativos-web/production`. Se conserva la cuenta, sus permisos y toda la información comercial; los datos de validación son sintéticos y aislados.

## Cambio

- La sesión autenticada autoriza online. `terminal()` localiza el cursor por `X-Pos-Installation` sin comprobar aprobación o token del navegador. Un cliente anterior puede identificar su cursor por un token conocido, incluso si estaba desactivado. Sin identificador reconocible, recibe una indicación explícita de actualizar para conservar su cursor.
- `/pos/enroll` es preparación de sincronización con la sesión: no exige token anterior, dueño ni repetir contraseña. Los campos de credenciales de clientes anteriores se aceptan por compatibilidad y no alteran el actor de sesión.
- El cliente prepara el transporte también al recuperar una sesión por cookie y conserva instalación, secuencia y pendientes. Las operaciones retenidas por la credencial anterior mantienen sus IDs, contenido y firma al reintentar.
- La sincronización sin sesión sigue usando token y concesión firmada. Los cursores, acuses y validaciones comerciales conservan sus límites. No hay migraciones SQL ni borrado de IndexedDB.
- HTML y `sw.js` se entregan con `Cache-Control: no-store`; las navegaciones del worker usan red sin caché HTTP y conservan el respaldo offline de la interfaz. Una actualización se activa desde un login vacío solo si todas las pestañas confirman que también están en un login vacío. Una venta, una credencial escrita o una pestaña antigua sin respuesta hacen que espere.

## Verificación

- TypeScript y compilación aprobados; 75/75 pruebas unitarias aprobadas. El worker comprueba activación permitida y rechazo cuando otro cliente no está listo. Registros `.local/session-only-typecheck.log`, `session-only-build.log`, `session-only-all-unit.log` y `session-only-worker.log`.
- 5/5 casos de integración de acceso contra PostgreSQL real: sesión válida con tokens inválidos/ausentes/desactivados, cursor conservado, actor de sesión respetado y rechazo sin sesión. Registro `.local/session-only-integration.log`.
- Recorrido focalizado de navegador aprobado: cuentas de cajero/dueño, perfiles nuevos y guardados, cookie, offline y actualización de login sin interrumpir la escritura. Registro `.local/session-only-smoke.log`.
- Regresión completa `foundation.spec.ts` aprobada, 1/1, en 3,0 minutos, con ventas, turnos, fidelización, offline, traslado histórico y actualización en espera durante una venta pendiente. Registro `.local/session-only-e2e.log`. El recorrido respeta `Retry-After` cuando sus numerosas entradas legítimas alcanzan el límite por IP y no espera respuesta de red en las pruebas offline. Estos ajustes son del fixture; no se modifica el límite de intentos del producto.

## Entrega

Publicar el commit que contiene esta evidencia mediante archivo Git de fuentes y configuración, verificar estado Railway, salud, recursos públicos y cabeceras. Registrar el despliegue fuera de Git con el mismo SHA. La comprobación de producción no usa credenciales ni opera turnos comerciales.
