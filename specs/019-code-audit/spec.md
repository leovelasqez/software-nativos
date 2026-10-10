# 019 — Revisión integral y mantenimiento del código

Estado: implementado y verificado localmente. Autorización: solicitud del usuario del 09-10-2026 para revisar vulnerabilidades, código obsoleto y refactorizar cuando sea necesario.

## Alcance

Revisar el árbol vigente de `software-nativos` desde `67d90f6`, sus dependencias, API, reglas de negocio, navegador offline, adaptadores históricos, pruebas y documentación. Preservar datos comerciales, archivos fuente e instalaciones anteriores. La revisión no autoriza operar Alegra, enviar mensajes ni publicar cambios nuevos.

## Requisitos

- REQ-019-01: corregir avisos de seguridad de dependencias con versiones compatibles y verificadas, manteniendo el runtime Node 24.
- REQ-019-02: la configuración inicial de un sitio expuesto requiere una clave de instalación externa; sin ella no se puede crear el primer dueño. El desarrollo en loopback conserva su flujo local.
- REQ-019-03: una corrección de caja genera exactamente una contrapartida, con validación local y central y sin alterar pendientes al rechazar una segunda corrección. Deriva de REQ-006-03 y del contrato de movimientos de caja.
- REQ-019-04: la auditoría conserva el tipo real de actor humano/agente, según REQ-001-04 y REQ-010-04.
- REQ-019-05: informes y paginación conservan importes válidos y permiten recorrer todos los resultados sin repetir ni rechazar sus propios cursores, según REQ-008-01/02 y REQ-010-01.
- REQ-019-06: retirar código sin uso confirmado y caches antiguos de interfaz sin borrar IndexedDB, datos de Caja ni compatibilidad de migración (DEC-021).
- REQ-019-07: la tolerancia de reloj ya autorizada se aplica consistentemente a concesiones, versiones de catálogo, apertura y fidelización, sin ampliar los cinco segundos definidos en REQ-007-04.
- REQ-019-08: el cierre remoto libera el navegador original aunque haya entrado otro usuario; preservar historial, responsables y permisos de continuación (AC-018-06).

- REQ-019-09: una contraseña local queda vinculada al actor autenticado; revalidación, recuperación de sesión, activación y cambio de caja no pueden sustituirlo por el actor de una cookie de otro usuario. Un login explícito con credenciales nuevas puede renovar la identidad.

## Aceptación

- AC-019-01: `npm audit` no informa vulnerabilidades conocidas después de instalar el lockfile corregido; tipos, dominio, integración y build siguen pasando.
- AC-019-02: en origen alojado, intentos sin clave o con clave incorrecta no crean usuarios ni sesiones; la clave válida permite una sola configuración y no aparece en respuestas/auditoría. La instalación local sigue funcionando.
- AC-019-03: después de corregir y sincronizar un movimiento, una segunda corrección se rechaza antes de persistir; conserva saldo, secuencia y cola. La interfaz no ofrece corregir de nuevo. Un reintento del mismo comando sigue siendo idempotente.
- AC-019-04: importaciones de agentes quedan auditadas como `agent`; configuración y operaciones humanas conservan `human`.
- AC-019-05: importes de diez o más dígitos y fracciones válidas se incluyen exactamente en totales; límites/cursores inválidos devuelven 400. Notificaciones e inventario de agentes admiten su propio `nextCursor` y la segunda página no repite filas.
- AC-019-06: TypeScript con detección de símbolos no usados pasa. Al activar una nueva versión del service worker, solo se retiran caches anteriores de la interfaz Nativos, preservando el cache actual y almacenes ajenos.
- AC-019-07: una operación con catálogo recién descargado y reloj cuatro segundos atrasado sincroniza conservando su versión; una operación fuera de los cinco segundos se rechaza sin consumir secuencia.
- AC-019-08: A abre y continúa su turno en otra instalación; B entra en la original; A cierra y sincroniza. B recibe únicamente IDs de cierres de instalaciones vinculadas, puede abrir su turno y no recibe el libro de A. La historia local de A conserva sus importes y fechas hasta recibir el cierre completo con la identidad correspondiente.

- AC-019-09: con concesiones válidas A=cajero/B=dueño y cookie B, la renovación anónima conserva A; revalidar o cambiar caja rechaza B antes de persistir. La contraseña A continúa entrando únicamente como A offline. Un login concurrente cuya respuesta de autorización corresponde a otro actor se rechaza, y renovar permisos del mismo actor o autenticar un usuario recreado con sus credenciales nuevas sigue permitido.

AC-019-05 incluye además exclusión de productos/recetas/insumos archivados en la consulta operativa de agentes, reversión causal única de iniciales `import_initial`, Excel válido con caracteres de usuario, compras filtradas por sus códigos históricos y ajustes/devoluciones de puntos filtrados por la fecha del movimiento. La fecha predeterminada de compra usa el día de Bogotá.

## Límites

La evidencia automática utiliza PostgreSQL, SQLite y perfiles de navegador sintéticos aislados. Una revisión de código no acredita hardware, recuperación ante pérdida física, envíos de WhatsApp ni carga comercial real. El informe separará errores corregidos, mejoras heurísticas y pendientes operativos documentados.

Evidencia final: [revisión del 09-10-2026](../../docs/evidence/code-audit-2026-10-09.md). AC-019-01 a 09 verificados con datos sintéticos. Publicación posterior autorizada el 10-10-2026: [evidencia de Railway](../../docs/evidence/code-audit-publication-2026-10-10.md).
