# Plan técnico — 015 Perfiles de Caja por sucursal y comprobante térmico

Estado: Verificado localmente. Referencia: `spec.md` de la capacidad.

## Incremento seleccionado

Incluye REQ-015-01 a 04. No incluye reconfiguración de dispositivos, impresión silenciosa, cajón, controladores ni aprobación de hardware; esos elementos siguen en 011.

## Diseño

`web/offline/engine.ts` conserva `terminalProfiles`, un agregado por `deviceId`, dentro del agregado cifrado de Caja. `switchTerminal` sincroniza el perfil actual, verifica que no existan outbox, canje incierto ni turno abierto, archiva el perfil y restaura o vincula el siguiente. La ruta local `/terminals` enumera sólo equipos activos de sucursales presentes en `/me`; `/terminal/switch` aplica la transición bajo el mismo Web Lock.

`migrations/018-pos-terminal-profiles.sql` elimina la unicidad global de `installation_id` y mantiene la unicidad por terminal. `src/server/pos-api.ts` conserva la autorización de sucursal para el enrolamiento y los tokens por terminal. `web/Pos.tsx` muestra el selector y vuelve a la venta después de una transición correcta.

El snapshot central continúa resolviendo una única bodega predeterminada para cada sucursal. `web/InventoryOperations.tsx` reúne las bodegas de las sucursales permitidas exclusivamente para identificar correctamente origen y destino de traslados; la escritura continúa validándose en servidor.

`web/pos.css` usa `@media print` y `@page` de 80 mm para aislar el comprobante. La superficie `thermal-receipt` usa blanco y negro también en pantalla, independiente del tema general. `window.print()` no comparte la ruta de cobro ni de sincronización.

## Contratos

Actualiza `contracts/browser-pos-v1.md`: perfiles por terminal, selección online, condiciones de seguridad antes del cambio y compatibilidad de instalación. `contracts/inventory-operations-v1.md` mantiene la regla de traslado entre bodegas autorizadas; esta capacidad sólo mejora su proyección visual.

## Migración y recuperación

La migración 018 es aditiva respecto a datos: elimina una restricción que impedía perfiles múltiples del mismo navegador y no modifica ventas, turnos, movimientos ni credenciales existentes. Si la nueva terminal no se puede vincular o autorizar, el perfil actual permanece guardado. El cambio nunca borra perfiles ni pendientes.

## Pruebas y operación

Se verifican TypeScript, contratos de navegador y build. En Caja local se comprobó el selector de sucursal, la conservación de perfiles y la etiqueta completa de un traslado; no se creó recepción ni movimiento durante la revisión. La hoja de impresión requiere repetir HW-01 a HW-05 y HW-07 en T80A y T82E antes de declarar la impresión física aprobada.

## Riesgos abiertos

El navegador y el controlador pueden ignorar `@page` o aplicar márgenes propios. La configuración física de papel, escala, impresora y cajón sólo se resuelve presencialmente y no debe diagnosticarse repitiendo una venta.
