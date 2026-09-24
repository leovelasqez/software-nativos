# Caja: espacio de trabajo y cantidades — 24-09-2026

Alcance autorizado por el usuario: compactar la cabecera, ampliar catálogo/pedido y añadir controles de cantidad − / +; después, hacer commit y publicar manualmente en Railway. Trazabilidad: REQ/AC-016-01/03/06/07/09.

## Implementación

Commit de aplicación `6ccad21bdb94f439b2e4548faed5e9a3ee2388b5`. Estado de conexión e inventario en cabecera desplegable; pedido sin scroll interno y catálogo con altura disponible. En 1366×596, tres líneas con total y acciones completas. Pedidos mayores que la pantalla desplazan el espacio de trabajo.

Los controles suman/restan una unidad con decimal/formatted y order.save. − se deshabilita con cantidad menor o igual a una; Quitar conserva eliminación explícita. Las unidades enviadas usan la cancelación con una unidad preseleccionada, motivo y cantidad preparada. Se conservan contratos, validaciones, permisos, idempotencia y persistencia. No hay migraciones nuevas en este cambio.

## Verificación

Checkout limpio de `6ccad21`, sin el trabajo de importación Excel pendiente:

- npm ci: instalación desde lockfile, sin vulnerabilidades reportadas.
- npm run check: TypeScript, 50/50 unitarias, 63/63 integraciones y compilación correctos.
- npm run test:e2e: 1/1 recorrido completo en Edge (2,4 min), con PostgreSQL e IndexedDB reales. Incluye controles − / + con actualización persistida, ausencia de editor y límite mínimo, además de regresiones de Caja, permisos, pagos, fidelización y recuperación offline.
- Revisión visual anterior con estado sintético: 1366×596, 1024×768, 390×844 y 320×740, claro/oscuro. Se comprobaron total, fracciones, unidades enviadas, bloqueo por conciliación, pedido largo y accesibilidad sin infracciones detectadas.

No se ejecutaron ventas ni cambios de inventario en producción durante estas verificaciones.

## Publicación

Carga manual mediante Railway CLI desde el checkout limpio del commit. Proyecto nativos, servicio nativos-web, ambiente production. Despliegue `e892d9d6-3088-4999-a9de-3e65d41bb2e0`. Estado final: SUCCESS; healthcheck de Railway correcto.

Comprobación pública posterior: /health respondió HTTP 200 con ok=true; /caja respondió HTTP 200. Su HTML coincide exactamente con el build local y los cuatro recursos referidos coinciden byte a byte por SHA-256:

- /assets/pos-CE7sOKSP.js
- /assets/client-DQlXZaAO.js
- /assets/engine-ID1nDrPF.js
- /assets/client-Bg5qVszr.css

/sw.js también coincide con el generado localmente. Se comprobó el arranque de npm start sin errores. Esta comprobación acredita la publicación del artefacto probado; no se hicieron operaciones comerciales en el sitio real.

Si un navegador conserva la interfaz anterior, cerrar las pestañas del sistema y volver a abrirlo permite activar la actualización offline. No borrar los datos del sitio ni IndexedDB.
