# 018 — Acceso a ambas cajas desde varios navegadores

Autorización: solicitud del 24-09-2026 de corregir `already_enrolled` y poder abrir Centro y Milán sin restricción de navegador. Sustituye la exclusividad de instalación de DEC-018 y el bloqueo de cambio por turno abierto de REQ-015-02. Conserva permisos, un turno comercial activo por caja y la conservación de pendientes.

- REQ-018-01 / AC-018-01: un dueño puede activar Centro y Milán en otro navegador sin invalidar tokens, operaciones pendientes ni cursores anteriores.
- REQ-018-02 / AC-018-02: cada combinación caja/instalación tiene una secuencia independiente. Dos instalaciones pueden enviar secuencia 1; el reintento propio es idempotente y otra instalación no puede apropiarse de ese acuse.
- REQ-018-03 / AC-018-03: cambiar entre Centro y Milán conserva turnos abiertos y pedidos aislados; volver o recargar recupera el perfil. El cambio requiere conexión y sincronización satisfactoria; un fallo conserva el perfil anterior.
- REQ-018-04 / AC-018-04: las vinculaciones y acuses existentes migran sin cambiar token, cursor, comprobante ni importe. El servidor sigue rechazando dos turnos simultáneos en la misma caja y operaciones sobre el turno de otra instalación. Antes de abrir online, se comprueba si hay otro turno para evitar dejar una apertura local rechazada.

Alcance inicial del 24-09-2026: los pedidos y pendientes sin sincronizar permanecen en su navegador de origen; no se replicaban agregados locales ni se trasladaban turnos. La ampliación siguiente sustituye esa limitación para el mismo turno confirmado, sin eliminar permisos ni crear turnos duplicados.

## Continuar el mismo turno — 25-09-2026

El usuario elige expresamente la opción 1: continuar el turno abierto desde otro computador. Sustituye la exclusividad del navegador de AC-018-04; conserva un turno por caja y su responsable.

- REQ/AC-018-05: el mismo responsable, con sesión online, permisos y navegador activado, puede elegir «Continuar este turno». Conserva identificador, base, apertura, ventas, devoluciones y movimientos sincronizados; no crea otra apertura ni altera los tokens o cursores.
- REQ/AC-018-06: ambos navegadores concilian el efectivo contra el mismo libro central. Una actualización no duplica ventas ni sobrescribe cambios locales pendientes. El cierre desde el segundo equipo se refleja en el primero cuando sincroniza. Otro usuario o sucursal no puede apropiarse del turno.
- REQ/AC-018-07: retomar requiere conexión y resolver los pendientes del navegador receptor. Los pendientes del otro equipo siguen en él y pueden sincronizarse mientras el turno siga abierto. Después de un cierre, una operación tardía se conserva para conciliación; no se borra ni se agrega silenciosamente a un cierre confirmado. La interfaz explica la necesidad de sincronizar los otros equipos antes del cierre. No se promete recuperar datos nunca enviados por un equipo inaccesible.
