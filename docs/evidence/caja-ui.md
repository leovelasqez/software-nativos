# Evidencia 016 — Interfaz de Caja

Verificada localmente el 18-09-2026 en `develop`. Autorización: implementar todas las mejoras propuestas y revisarlas en navegador. Datos de catálogo, pedidos, clientes, turnos y cobros utilizados aquí son sintéticos.

## Implementación y comprobaciones

| Requisito / aceptación | Implementación | Evidencia |
| --- | --- | --- |
| REQ/AC-016-01 | Pos.tsx y pos.css: cabecera compacta, columnas con desplazamiento independiente, resumen fijo, navegación móvil desplegable y Productos/Pedido | caja-ui-flow.ts: 30 productos adicionales y 12 líneas, 1366×768/1024×768/390×844; cobro en viewport después de desplazar ambas listas |
| REQ/AC-016-02 | Categorías, búsqueda normalizada por palabras/nombre/referencia, contador, limpiar y vacío con recuperación | 30 coincidencias con `CAFE revisión`, 15 al elegir Cafetería, ninguna con texto inexistente y recuperación de catálogo; pruebas unitarias de tildes/espacios |
| REQ/AC-016-03 | Cabecera con atención/cliente editables, nombre y monto en selector, plural, ID en ayuda; líneas con importe, descuento/notas condicionales y estado de envío | Capturas del pedido; prueba de foco directo en Cantidad; pos-flow conserva mesa/domicilio/cliente, descuentos, notas, preparación y cancelación con desperdicio |
| REQ/AC-016-04 | Cobro completo inicial, división explícita, puntos desplegables, área de campos desplazable y pie persistente | Caja UI verifica 0 campos de división iniciales y 12 al activar; regresión cobra selección parcial y luego conserva saldo, puntos/canje/devolución verificados |
| REQ/AC-016-05 | paymentPreview/exactPayment con decimal/formatted y paymentTotals compartidos; Total/Recibido/Falta/Cambio, medios distintos | 3 pruebas unitarias nuevas; E2E mantiene 60000 recibidos al cambiar total a 61000 y exacto lo completa; revisión directa rechaza Nequi 70000 para total 63000, luego completa Nequi 53000 conservando efectivo 10000 y emite comprobante sintético de 63000 con cambio 0 |
| REQ/AC-016-06 | Estados con texto/icono, motivo de cobro bloqueado, detalles de conexión/guardado, altas offline explicadas, alertas con altura limitada y cursor ocupado/indisponible | Estado sincronizado y pendiente visibles; browser-flow prueba desconexión, altas deshabilitadas, canje pendiente, expiración y recuperación; apertura/turno y pedido vacío cubiertos por pos-flow |
| REQ/AC-016-07 | Modo claro/oscuro, foco de entrada y retorno al cerrar diálogo, lectura a 320 px | Axe sin infracciones en los escenarios ejecutados; sin desbordamiento horizontal a 390/1024/1366; captura manual a 320×740 revisada después de corregir el ajuste de importes |

## Resultados

- `npm run check`: aprobado, 39 pruebas unitarias y 57 de integración, TypeScript y compilación.
- Tras los ajustes finales de UI: `npm run typecheck` y `npm run build` sin errores; `npm run test:e2e` aprobado (1 prueba integral compuesta, 2,1 minutos).
- E2E usa Edge real, PostgreSQL sintético, IndexedDB y service worker. Incluye configuración y administración, pedidos, pagos combinados, división, devoluciones, puntos, cierre, reapertura offline, concurrencia de pestañas y recuperación tras respuesta perdida.
- Revisión directa adicional en Edge mediante agent-browser/CDP sobre otro servidor y base sintéticos (4322): móvil, formulario de cobro, importe exacto, exceso digital rechazado y cobro combinado confirmado.
- Se corrigió la restauración del foco al cerrar formularios y se amplió el espacio para importes a 320 px. La suite comprobó después el foco de cantidad y el retorno al botón Cobrar.
- Se actualizaron selectores de una prueba de traslados al nombre vigente `Sucursal · Bodega`. Las capturas automáticas se escriben en `test-results/` para evitar sobrescribir evidencia histórica; una ejecución final aprobada se copió a esta carpeta de evidencia. Dos intentos anteriores fallaron por un error de apertura de archivos históricos de Windows, antes de llegar a Caja.

## Capturas revisadas

- [Escritorio claro](caja-ui/desktop-light.png) y [oscuro](caja-ui/desktop-dark.png).
- [Tablet claro](caja-ui/tablet-light.png) y [oscuro](caja-ui/tablet-dark.png).
- [Móvil productos](caja-ui/mobile-light.png) y [pedido](caja-ui/mobile-order-light.png), también en [oscuro](caja-ui/mobile-order-dark.png).
- [Cobro escritorio](caja-ui/checkout-1366.png), [móvil](caja-ui/checkout-390.png) y [320 px](caja-ui/manual-small-checkout.png).
- [Exceso digital](caja-ui/manual-digital-excess.png) y [rechazo de confirmación](caja-ui/manual-payment-error.png).

No se alteraron datos comerciales, reglas de inventario/puntos, contratos ni persistencia. No se desplegó ni se validó hardware físico. Las capturas y los tiempos corresponden a pruebas sintéticas, no a una medición de operación comercial.
