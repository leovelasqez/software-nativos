# Comprobante de cierre de caja — 07-10-2026

Solicitud: el cierre no generaba un comprobante con ventas, ingresos, salidas y medios de pago. Corrección implementada y verificada localmente con datos sintéticos. No se publicó en Railway ni se operaron turnos comerciales.

## Comportamiento verificado

- AC-006-07: confirmar cierre muestra automáticamente su comprobante interno. Incluye identidad/apertura/cierre/responsable, base, esperado, contado, diferencia, ventas, devoluciones, ingresos, gastos, retiros, correcciones, propina/domicilio netos, cambio y detalle cronológico. Los seis medios aparecen con ventas, devoluciones, movimientos manuales y neto; no duplica propina/domicilio ni cuenta el cambio como ingreso.
- AC-006-08: cierre y copia se guardan en la misma transacción IndexedDB. Cierre offline de base $50.000, venta aplicada $28.000 y gasto $1.000 conserva esperado $77.000, contado $77.500 y diferencia $500 tras recargar. Consultar la copia y pulsar imprimir conserva la cantidad de pendientes. La acción de impresión se verifica con sustitución controlada de `window.print`, sin enviar trabajo a una impresora.
- AC-006-09: turno compartido con dos cobros de $16.000, una devolución de $16.000 y un ingreso de $50 con contrapartida cierra en $16.100 incluida base $100; el comprobante contiene cinco movimientos sin duplicarlos y se recupera sincronizado desde el navegador original. La integración recupera también cierres previos sin continuación y rechaza la proyección a una instalación independiente.
- La prueba de dominio incluye 60 cobros, seis medios, precisión a seis decimales, excedente efectivo, devolución parcial, contrapartida digital, cierre vacío y saldo de efectivo negativo.
- E2E revisa móvil/escritorio, claro/oscuro, teclado/Escape, accesibilidad axe y formato de impresión de 72 mm útiles, sin controles o navegación del sistema en el papel.

## Comandos y resultados

- `npm.cmd run check`: correcto; TypeScript, 59 pruebas unitarias y 66 pruebas de integración, build Vite y shell offline.
- `npm.cmd run typecheck`: correcto después de ampliar las comprobaciones de navegador.
- `npm.cmd run test:e2e`: 1 escenario integral correcto (4,4 minutos), con PostgreSQL sintético, Edge, IndexedDB y service worker reales.
- `git diff --check`: correcto.

## Evidencia visual

Capturas revisadas y conservadas en [comprobante-cierre-2026-10-07/](comprobante-cierre-2026-10-07/): `close-desktop-light.png`, `close-desktop-dark.png`, `close-mobile-light.png`, `close-mobile-dark.png` y `shared-close-receipt.png`. Muestran el comprobante dentro del diálogo con desplazamiento para el detalle completo.

## Límites

Sin publicación en el servicio alojado. La impresión física en T80A/T82E y cajón USB requiere verificación en los locales; el ancho y la acción de imprimir se comprobaron en navegador. Los movimientos de otra instalación que nunca se sincronizaron permanecen en ese equipo y no se inventan en un cierre confirmado. Se conservan perfiles, outbox y fuentes de datos existentes.
