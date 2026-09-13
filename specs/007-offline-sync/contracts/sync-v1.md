# Autorización offline y sincronización v1

REQ-007-01/02/03/04/05; AC-007-01/02/03/04/06. DEC-003/004.

## Autorización

Concesión con version=1, grantId, actorId, deviceId, branchId, validatedAtMs, expiresAtMs y actions. Fechas enteras Unix ms, vencimiento > validación y <= validación + 604800000. Firma Ed25519 central sobre bytes exactos del documento, con keyId y clave pública confiable distribuida fuera del documento. Clave privada solo servidor. La validación criptográfica y del emisor/audiencia es responsabilidad del adaptador, pendiente. La política ejecutable recibe exclusivamente concesiones autenticadas; no es endpoint público.

Al reconectar validar sesión/usuario/equipo y permisos antes de emitir nueva concesión; no renovar ante timeout. Revocación conocida bloquea acceso. Operaciones ya confirmadas localmente se conservan y envían por identidad de equipo para revisión si actor fue revocado; no se borran ni recalculan ni se ignora silenciosamente el rechazo.

Caja Windows almacena credenciales y concesión mediante protección del sistema operativo; Electron renderer sin acceso directo a secretos ni SQLite. Estado temporal conserva máximo observado protegido; en ejecución usa además tiempo monotónico. Retroceso respecto de validatedAtMs/lastObservedAtMs implica clock_untrusted y bloquea cobro. Tras reinicio, comparar máximo persistido y reloj; no afirmar resistencia contra administrador que manipule equipo/disco/reloj. No se implementa todavía almacenamiento protegido.

Offline dentro de plazo: lectura, pedidos, descuento, cancelación, cobro, apertura/cierre de turno. Altas, compras, inventario administrativo, configuración, devoluciones autorizadas y canje requieren servidor en v1. Al vencer, solo data.read, order.write (guardar/editar sin cobrar) y shift.close del turno existente. La existencia del turno se verifica en dominio de caja futuro. No iniciar nuevos turnos ni eliminar pendientes. Denegar si no hay concesión íntegra para usuario/equipo/local aun en modo consulta. Permisos efectivos son intersección de principal y concesión.

## Operación y acuse

Envoltura cerrada `contracts/sync-v1.schema.json`: version, operationId (UUID), deviceId, branchId, actorId, sequence (entero positivo por equipo), previousOperationId (null solo secuencia 1), payloadHash (SHA-256 hexadecimal), payloadVersion (1). Hash sobre bytes UTF-8 inmutables del payload guardado al commit, no JSON reserializado. No existe payload de venta implementado todavía: antes de transmitir se requiere contrato completo de 004/006/007 y validar hash contra bytes, versión, importes y autorización.

1. SQLite: BEGIN; comprobar turno y concesión; guardar snapshots de catálogo/precio/impuesto/receta y pagos, consumos, movimiento caja, secuencia/outbox; COMMIT. Impresión posterior, nunca desencadena cobro. Antes del commit no hay efecto; después hay operación recuperable.
2. Enviar misma envoltura/payload ante reintento. PostgreSQL valida identidad de equipo y sucursal, payload y hash. Unicidad global operationId y (deviceId, sequence). Misma operación y contenido devuelve acuse guardado; distinto contenido/identidad produce conflicto sin sobrescribir. Concurrencia se resuelve con restricción/transacción, no solo consulta previa.
3. Orden por equipo: recibir secuencia siguiente con previousOperationId correcto. Si falta predecesor, mantener esperando y solicitarlo. Dependencias de receta/precio conservadas en snapshots; no sustituir por catálogo actual. Entradas de inventario tardías se conservan como movimientos y se reconcilian según DEC-005, sin reescribir venta.
4. Commit central atómico de efectos y recibo antes de responder accepted cuyo receipt repite exactamente todos los campos de la envoltura (incluidos actorId, previousOperationId y versiones); así comparte el esquema sync-v1. Respuesta perdida: local sigue pendiente y reenvía; servidor devuelve mismo recibo sin repetir efectos/puntos.
5. Local valida que acuse corresponde a toda la identidad/hash de la operación; marca acknowledged en transacción. Fallo local antes de marcar: reintento seguro. Conservar venta y auditoría; marcar no equivale a borrar historia.

Estados puros implementados: pending, retry, reconciliation_required, acknowledged. Transporte fallido -> retry; versión/conflicto/rechazo -> reconciliation_required; accepted coincidente -> acknowledged; acuse distinto se ignora. acknowledged es terminal y no retrocede. Esta máquina NO ejecuta efectos ni demuestra durabilidad central/local.

Errores del futuro transporte: 401 reautenticar equipo, 403 conciliación sin perder operación, 409 conflicto o predecesor pendiente distinguido por código, 422 payload inválido, 426 versión incompatible, 429/5xx reintento con backoff acotado y jitter. Cualquier fallo conserva datos. Paginación de descarga mediante cursor y versión de snapshot; aplicar catálogo completo validado en transacción, nunca marcar descarga parcial como actual. Mostrar última sincronización confirmada por sucursal. Contrato HTTP/OpenAPI y esquema de catálogo pendientes antes de implementar transporte.
