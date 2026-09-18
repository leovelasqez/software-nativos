# 015 — Perfiles de Caja por sucursal y comprobante térmico

Estado: Verificada localmente; aceptación física pendiente. Autorización de implementación: solicitudes del usuario del 18-09-2026 para cambiar sucursal en Caja, identificar bodegas de traslado y adaptar el comprobante a 80 mm.

## Objetivo y alcance

Permitir que una Caja ya activada en un navegador cambie entre las cajas activas de las sucursales autorizadas, sin mezclar sus pedidos, turnos, comprobantes, secuencias ni pendientes. Cada venta conserva la bodega predeterminada de la sucursal de su terminal. Administración identifica de forma inequívoca las bodegas de origen y destino de un traslado. El comprobante interno se imprime en papel térmico de 80 mm, blanco y con tipografía negra.

No autoriza operación sin conexión para cambiar de sucursal, reasignar equipos, crear una bodega, reemplazar saldos mediante devoluciones ni acredita impresión física o puesta en producción.

## Requisitos

- REQ-015-01: Caja muestra las terminales activas de las sucursales a las que el usuario conectado tiene acceso y permite cambiar a una de ellas sólo con conexión.
- REQ-015-02: antes de cambiar de terminal, Caja sincroniza; bloquea el cambio si hay pendientes, canje incierto o turno abierto. Cada terminal conserva un perfil aislado en el mismo navegador.
- REQ-015-03: toda venta descuenta existencias exclusivamente de la bodega predeterminada de la sucursal contenida en el snapshot de esa terminal. Un traslado muestra `Sucursal · Bodega` tanto en origen como en destino, incluso si sus bodegas comparten nombre.
- REQ-015-04: al imprimir un comprobante interno se emite sólo el comprobante con ancho de papel de 80 mm, fondo blanco, texto negro, datos compactos y sin volver a ejecutar un cobro.

## Flujos y datos

El cambio lista únicamente dispositivos activos obtenidos de las sucursales autorizadas. El perfil vigente se guarda por `deviceId`; al entrar a otro perfil existente se reanuda su instalación, cursor, concesiones, pedidos, ventas, devoluciones, turno y outbox. Si no existe, se crea un perfil vacío con el mismo `installationId` del navegador y se vincula a la terminal seleccionada. La base permite más de un perfil de terminal por instalación, pero no más de uno por `deviceId`.

La sincronización conserva la validación servidor de usuario, dispositivo y sucursal. El snapshot resuelve su `warehouseId` usando la bodega predeterminada de la sucursal; los movimientos de cobro usan ese identificador, no una selección visual de inventario.

Los traslados siguen siendo operaciones administrativas online. La etiqueta ampliada no altera sus cantidades, estados ni su libro inmutable. El formato de impresión cambia sólo CSS y el botón abre el diálogo estándar del navegador; cancelar o fallar ese diálogo no ejecuta una venta ni un movimiento.

## Aceptación

- AC-015-01 → REQ-015-01/02. Dada una sesión con acceso a Centro y Milán y perfiles sin pendientes ni turno, cuando selecciona la otra Caja, entonces recibe el snapshot de esa sucursal y el perfil anterior permanece aislado. Con pendiente, canje incierto o turno abierto, el cambio se rechaza sin descartar datos.
- AC-015-02 → REQ-015-03. Dadas Caja Centro y Caja Milán con bodegas predeterminadas distintas, cuando se cobra un preparado en cada una, entonces cada movimiento de consumo apunta a la bodega de su propio snapshot, una sola vez por operación.
- AC-015-03 → REQ-015-03. Dado un traslado entre bodegas homónimas de sucursales diferentes, cuando se crea, lista o recibe, entonces se muestran ambos nombres de sucursal junto con sus bodegas.
- AC-015-04 → REQ-015-04. Dado un comprobante guardado, cuando se abre la impresión, entonces la hoja contiene sólo el comprobante con ancho de 80 mm, fondo blanco y texto negro; cerrar el diálogo no duplica cobro, inventario ni pendiente.

## Dependencias y decisiones

Extiende 001 (sucursales, bodegas y equipos), 003 (libro por bodega), 004/006 (cobro, devolución y turno), 007/012 (Caja web y recuperación) y AC-011-07 (ensayo físico de impresión). Las devoluciones de preparados ya se rigen por REQ-003-04: devuelven dinero y no reingresan ingredientes.

## Evidencia

Implementación, comprobación local y límites: [evidencia 015](../../docs/evidence/caja-branch-profiles.md). La aprobación física de T80A y T82E sigue pendiente según [hardware-acceptance](../../docs/operations/hardware-acceptance.md).
