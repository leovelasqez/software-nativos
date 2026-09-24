# 018 — Acceso a ambas cajas desde varios navegadores

Autorización: solicitud del 24-09-2026 de corregir `already_enrolled` y poder abrir Centro y Milán sin restricción de navegador. Sustituye la exclusividad de instalación de DEC-018 y el bloqueo de cambio por turno abierto de REQ-015-02. Conserva permisos, un turno comercial activo por caja y la conservación de pendientes.

- REQ-018-01 / AC-018-01: un dueño puede activar Centro y Milán en otro navegador sin invalidar tokens, operaciones pendientes ni cursores anteriores.
- REQ-018-02 / AC-018-02: cada combinación caja/instalación tiene una secuencia independiente. Dos instalaciones pueden enviar secuencia 1; el reintento propio es idempotente y otra instalación no puede apropiarse de ese acuse.
- REQ-018-03 / AC-018-03: cambiar entre Centro y Milán conserva turnos abiertos y pedidos aislados; volver o recargar recupera el perfil. El cambio requiere conexión y sincronización satisfactoria; un fallo conserva el perfil anterior.
- REQ-018-04 / AC-018-04: las vinculaciones y acuses existentes migran sin cambiar token, cursor, comprobante ni importe. El servidor sigue rechazando dos turnos simultáneos en la misma caja y operaciones sobre el turno de otra instalación. Antes de abrir online, se comprueba si hay otro turno para evitar dejar una apertura local rechazada.

Los pedidos y pendientes sin sincronizar permanecen en su navegador de origen. Esta entrega no replica agregados locales ni traslada turnos entre navegadores. Abrir ambas cajas significa acceder a sus perfiles y alternarlos; no eliminar permisos ni crear turnos duplicados.
