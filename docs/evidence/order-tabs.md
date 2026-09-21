# AC-016-08 — Pestañas de pedidos abiertos

Implementado y verificado inicialmente el 19-09-2026; la primera versión se publicó el 20-09-2026. El ajuste solicitado el 20-09-2026 permite cerrar la única venta virtual, elimina la confirmación para vacíos y agrega cambio de nombre. Se conserva el diseño Nativos del resto de la pantalla y no se operó sobre pedidos reales durante las pruebas.

## Comportamiento

- Pestañas inferiores con Venta principal, números estables o nombre/mesa, indicador de líneas, importe en tooltip, +, lápiz para renombrar y cierre individual.
- Flechas, Home/End, F2 y Supr; foco y selección conservados. La barra se desplaza sin mover el catálogo, también con muchas ventas. En móvil no cubre Cobrar.
- Un pedido vacío guardado se cierra inmediatamente mediante `order.cancel`, sin diálogo, consumo ni cobro. Desde la corrección del 21-09-2026, cerrar la última pestaña deja cero ventas abiertas hasta pulsar +. Si aún es virtual, se descarta localmente sin guardar un pedido ficticio ni consumir numeración. Al cerrar otra pestaña se mantiene la activa; al cerrar la activa se elige una vecina si existe.
- El nombre editable reutiliza `OrderV2.label` y `order.save`; no agrega campos ni migraciones y se conserva offline.
- El cierre de pedidos con productos cancela todo lo pendiente: exige motivo y permite indicar cuántas unidades enviadas ya se prepararon, conservando el desperdicio existente. Cancelación parcial de líneas sigue disponible por Quitar.
- No hay migración de base de datos ni cambio de schemas: v2/v3 ya permitían lines vacío; se restringe en dominio a pedidos que tampoco tienen líneas. Selección y cierres se conservan en IndexedDB/outbox.

## Verificación inicial (20-09-2026)

- `npm.cmd run typecheck`: aprobado.
- `npm.cmd test`: 50 pruebas aprobadas; incluye cierre vacío, revisión/motivo, rechazo de selección vacía con productos, numeración estable y selección vecina.
- `node --test tests/integration/orders.test.ts`: 8 pruebas aprobadas. Nuevo escenario verifica cierre offline, repetición del mismo ID, reinicio, aceptación PostgreSQL y cero cambios en ventas/inventario.
- `npm.cmd run build`: aprobado.
- `npm.cmd run check`: TypeScript, 50/50 pruebas unitarias, 59/59 integraciones seriales y build aprobados en un worktree limpio.
- `npm.cmd run test:e2e`: prueba integral compuesta aprobada en la ejecución final (1,8 minutos). Edge real, PostgreSQL sintético, service worker e IndexedDB; ocho pestañas adicionales, cierre vacío inmediato online/offline, recarga, cierre de la única venta virtual, número nuevo y cambio de nombre. Conserva regresión de cobros, división, preparación/desperdicio, devoluciones, puntos y recuperación offline. Axe sin infracciones en las vistas comprobadas.
- Escritorio 1366×768, tablet 1024×768 y móvil 390×844 en claro/oscuro; catálogo largo y pedido largo, sin desbordar documento ni tapar cobro.
- Revisión directa adicional con Playwright CLI y otra base sintética en 4322: activar una caja nueva, + desde venta virtual, cerrar ambas pestañas vacías, recargar y comprobar una venta nueva disponible con 0 pendientes y sin resucitar las anteriores. La revisión visual motivó ajustar el desplazamiento de la pestaña activa al redimensionar para conservar visible su botón de cierre.

## Corrección del 21-09-2026 — cero ventas abiertas

- Código: `2c39802`. Validado desde un worktree limpio, sin los cambios de importación Excel en curso.
- `npm run check`: TypeScript, 50/50 pruebas unitarias, 59/59 integraciones y build aprobados.
- E2E integral aprobado (1 prueba compuesta, 2,7 minutos): cierre del borrador virtual sin consumir número; cierre de la última venta guardada; cero pestañas tras recarga offline y sincronización; + crea exactamente una venta; cambio de nombre y regresiones de cobro conservados.
- Revisión visual directa de cero ventas en escritorio 1440 px y móvil 390 px: mensaje claro, + visible y sin superposición. Axe sin infracciones en ambos tamaños.
- Capturas sintéticas: [cero ventas escritorio](order-tabs/no-open-sales-1440.png) y [cero ventas móvil](order-tabs/no-open-sales-390.png).
- No se manipularon pedidos reales ni se borraron datos del navegador.
- Producción: revisión `e1ad685`, despliegue Railway `8d48eacb-2ad4-4ee2-a91c-206bd268d68a` en SUCCESS el 21-09-2026. `/health` y `/caja` respondieron 200; HTML entrega `pos-D3Eru9vQ.js`, con el estado «No hay ventas abiertas» y la ruta `/v2/dismiss-draft`. Verificación productiva de entrega de versión, sin operar ventas reales.

### Capturas anteriores

[Escritorio](order-tabs/desktop-light.png), [oscuro](order-tabs/desktop-dark.png), [móvil](order-tabs/mobile-light.png), [pedido móvil oscuro](order-tabs/mobile-order-dark.png) y [muchas pestañas](order-tabs/open-order-tabs.png). Datos exclusivamente sintéticos.

La semántica usa tablist con aria-owns para separar los botones de cierre de las pestañas, conforme a [WAI-ARIA](https://www.w3.org/TR/wai-aria/#tab). No se anidan controles interactivos ni se ocultan cierres a tecnologías de asistencia. La verificación automática no sustituye pruebas con cada lector de pantalla.
