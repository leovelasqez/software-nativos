# Revisar el comprobante antes de cerrar — 07-10-2026

Ampliación del comprobante de cierre solicitado y publicado en esta conversación. El usuario pide comprobar los movimientos mientras el turno sigue abierto y aporta una imagen de referencia. Sus cifras no se cargan ni se usan como datos comerciales.

## Implementación y aceptación verificada

- AC-006-10: Caja → Turno → «Revisar movimientos» abre «Comprobante del turno en curso». Reutiliza los totales/detalle del cierre y se imprime con «Imprimir revisión». Muestra apertura, fecha de consulta, responsable, base, efectivo esperado, ventas, devoluciones, ingresos, gastos, retiros, correcciones, seis medios, propinas, domicilios y cambio.
- Los campos de fecha de cierre, contado y diferencia permanecen `null`. La pantalla y el papel indican «Vista previa · El turno sigue abierto», «Pendiente de conteo» y «Pendiente de cierre».
- La prueba offline lee y descifra el agregado real de IndexedDB antes y después de revisar/imprimir/recargar. Compara turnos, secuencia, eventos, comandos, pendientes e IDs de comprobantes; permanecen iguales y no se persiste `currentShiftPreview`. El cierre posterior conserva los mismos totales de la revisión si no existen movimientos adicionales.
- AC-006-11: el cálculo del comprobante y la revisión es compartido. El libro reúne registros locales/centrales por identificador sin duplicarlos. La revisión compartida muestra dos ventas por $32.000 y propina $2.000, y después refleja devolución/corrección y efectivo esperado $16.100. El temporizador sigue activo mientras se revisa y transforma la vista en comprobante confirmado si otro miembro cierra el turno.
- El contrato de cierre sigue rechazando turnos abiertos; la revisión rechaza turnos cerrados o con conteo registrado. No se modifican eventos de sincronización, permisos, migraciones ni almacenamiento de perfiles.

## Validación

- `npm.cmd run typecheck`: correcto.
- `npm.cmd test`: 61 pruebas unitarias correctas, incluidas igualdad entre revisión/cierre, actualización de totales y consulta vacía sin conteo inventado.
- `node --test --test-concurrency=1 tests/integration/cash.test.ts tests/integration/caja-access.test.ts`: 6 pruebas correctas, PostgreSQL real y aislamiento de instalaciones/permisos.
- `npm.cmd run build`: correcto; entradas `pos-zOB2DeSE.js` y `engine-DOuoKbkf.js`.
- `npm.cmd run test:e2e`: 1 escenario integral correcto (3,2 minutos); Edge, PostgreSQL sintético, IndexedDB cifrado, service worker y impresión CSS reales. La acción de impresión se verifica con una sustitución controlada de `window.print`, sin enviar trabajos a hardware.
- `git diff --check`: correcto. Capturas revisadas de escritorio/móvil y claro/oscuro con axe sin infracciones y sin desbordamiento horizontal.

Capturas en [revision-turno-abierto-2026-10-07/](revision-turno-abierto-2026-10-07/): cuatro `review-*.png` y `shared-open-review.png`.

## Publicación y límites

Ampliación verificada; publicación en el mismo servicio autorizada como continuación del comprobante en esta conversación. La verificación productiva será de disponibilidad y versión, sin operar turnos comerciales. Movimientos nunca enviados por otros equipos deben sincronizarse para aparecer. La impresión física conserva la verificación pendiente de los locales.
