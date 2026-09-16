# Revisión de dirección — Un sitio web para Nativos

Solicitud del 15-09-2026: sustituir Administración web + app Windows por un único sitio. Confirmación posterior: conservar Caja hasta siete días sin internet y recuperar pedidos al cerrar/reabrir el navegador.

| Área revisada | Decisión aplicada |
| --- | --- |
| Plan, agentes, arquitectura, roadmap y specs | DEC-021 prevalece; transición 5W/012 antes de Administración completa. Los planes anteriores se identifican como históricos. |
| Catálogo, recetas, impuestos, descuentos y dinero | Reutilizar dominio exacto y versiones; no cambiar las reglas del negocio. |
| Usuarios, permisos y sucursales | Conservar servidor y cookie web; sesión de Caja en el mismo origen, inscripción de navegador y concesión offline. |
| Pedidos, comandas, división y turnos | Componentes existentes con adaptador IndexedDB y bloqueo entre pestañas. |
| Fidelización y devoluciones | Conservar cálculo, transacción central, outbox v3 y recuperación del canje. |
| PostgreSQL y sincronización | API existente; migraciones 001–005 intactas. Servidor conserva validación de todas las operaciones. |
| SQLite/DPAPI | Adaptadores históricos y fuente para traslado, sin borrado de datos. Nueva custodia cifrada en el perfil del navegador. |
| Electron y lanzadores | Dependencia y comando de escritorio retirados; desarrollo abre solo servidor web y PostgreSQL. |
| Navegación y conexión | `/` y `/caja` del mismo sitio. Shell offline sin cachear API. Sincronización al abrir y con Caja activa. |
| Pruebas | Suite comercial reutilizada en un origen; nuevas pruebas reales IndexedDB, cierre de navegador, pestañas, aborto, canje, credenciales y siete días. |
| Compras, informes y Excel | Siguen en incremento 6 sobre el sitio único; no se consideran implementados por esta transición. |
| WhatsApp, API/MCP y Alegra | Alcance conservado para siguientes incrementos; sin nuevos envíos, migraciones comerciales ni escrituras externas. |
| Hardware y respaldo | Ensayar navegador/impresoras/cajón; respaldo central cubre lo sincronizado. No prometer recuperación si se borra el perfil con pendientes. |

La aplicación de desarrollo usa una sola dirección: http://127.0.0.1:4310/. La dirección definitiva HTTPS corresponde a una futura publicación autorizada; no se contrató alojamiento.

El traslado desde la caja anterior se inicia con **Trasladar caja anterior**, entrando como dueño desde el perfil elegido para usar Caja. No se hace automáticamente a un navegador de pruebas ni se copia la instalación a varios perfiles. Conserva la fuente, la secuencia y los pendientes; tras el traslado, el motor anterior queda retirado.

Diseño y requisitos: [spec 012](../specs/012-unified-web/spec.md), [contrato](../contracts/browser-pos-v1.md). Evidencia de implementación: [verificación](evidence/unified-web.md).
