# 018 — Acceso a ambas cajas desde varios navegadores

## Acceso con usuario y contraseña — 01-11-2026

Autorización: el usuario solicita «lo unico que se debe requerir es la opcion de usuario y contraseña, no quiero que haya una restriccion por navegador». Sustituye el requisito de primera activación por el dueño de AC-018-09. Alcance: entrada online desde cualquier navegador, incluidos perfiles nuevos y privados, con los permisos vigentes de la cuenta.

- REQ/AC-018-12: dado un navegador sin datos de Caja y una cuenta activa con una caja autorizada, al validar usuario y contraseña se prepara automáticamente la instalación y se entra a esa caja, sin dueño, token de origen ni formulario de activación. Conserva la selección por cuenta de AC-018-08; también aplica al dueño y al ingreso desde Administración. Un segundo navegador recibe su propia instalación sin invalidar el primero.
- REQ/AC-018-13: credenciales incorrectas, sesión ausente/revocada, sucursal no autorizada, falta de permiso de lectura o equipo inactivo no permiten preparar ni consultar Caja. Los tokens siguen identificando las colas de sincronización; conocer el identificador de una instalación existente no permite sustituir su token ni recuperar sus acuses. Los clientes anteriores pueden seguir enviando `sourceDeviceId`.
- REQ/AC-018-14: acceso automático conserva datos, permisos, preferencias y turnos existentes; errores de preparación no borran perfiles. Pedidos y pendientes sin sincronizar no se trasladan entre navegadores. Offline exige una validación previa de esa cuenta en ese navegador, con los mismos siete días de vigencia. La recuperación histórica local continúa disponible únicamente cuando existe una caja anterior y el dueño la elige.

## Sucursal por cuenta — 14-10-2026

Corrección solicitada tras el bloqueo de una cuenta de caja: «no deberían quedar anclado a la sucursal de otro usuario».

- REQ/AC-018-08: al entrar online, elegir la última caja autorizada usada por ese actor. Sin preferencia válida, usar la primera caja activa de sus sucursales autorizadas, en orden estable. Un cajero exclusivo de Centro entra a Centro aunque el usuario anterior haya usado Milán. El selector actualiza únicamente la preferencia de su cuenta. Al trasladar una caja anterior, conservar como preferencia del actor verificado la caja importada, sin cambiar su turno, base o pendientes.
- REQ/AC-018-09 (histórico, sustituido por AC-018-12/13 el 01-11-2026): el primer acceso requería dueño y las cajas siguientes un token de origen de la misma instalación. Se conservan la verificación de sucursal, los permisos y los tokens de perfiles guardados.
- REQ/AC-018-10: login conserva pedidos, turnos, cursores y pendientes de otras cajas, incluso si requieren conciliación. No exige operar o sincronizar la sucursal de otra cuenta para entrar a la propia. Un fallo del destino conserva el perfil anterior. El cambio manual dentro de una sesión mantiene la sincronización previa y sus restricciones.
- REQ/AC-018-11: offline, entrar solo a perfiles con contraseña y autorización firmada válidas para ese usuario, preferir su última caja y conservar las demás. No crear vinculaciones offline, reutilizar cookies de otro actor ni aceptar contraseñas erróneas o permisos revocados.

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
