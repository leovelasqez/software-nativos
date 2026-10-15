# Vendedores v1 — REQ-020

## Identidad y permisos

Vendedor: id opaco, nombre, activo, branchIds y versión entera positiva. No tiene login, contraseña, rol ni permisos. Se conserva el actor autenticado de cobro/auditoría y el responsable del turno. Administrar requiere dueño + settings.manage, alcance de todas las sucursales asignadas, conexión y motivo de 3–500 caracteres.

## Registro

GET /api/sellers?branchId=… devuelve registros de la sucursal autorizada (nombre/estado/versión). Consulta con branchId=all restringida al administrador y a vendedores completamente dentro de su alcance. POST /api/sellers crea con operationId UUID, name (2–100 caracteres no blancos), branchIds existentes, active y reason. PATCH /api/sellers/:id usa el mismo cuerpo y expectedVersion; conflicto de versión 409. Misma operationId/actor/cuerpo devuelve el mismo resultado; reutilización distinta 409. No DELETE. Mutación, versión, acuse y auditoría se confirman juntos.

## Caja y compatibilidad

Snapshot conserva vendedores activos de la sucursal en una proyección explícita. Su contenido participa del hash del snapshot. Cobro nuevo referencia vendedor y snapshot; servidor resuelve identidad histórica y valida pertenencia. Versiones anteriores siguen aceptadas sin atribuir vendedor. Nombres e importes históricos no cambian al editar o desactivar.

## Comisión por producto

GET /api/seller-commissions lista productos comerciales con id/nombre/presentación, versión (0 si aún no existe) e importe nullable. POST /api/seller-commissions/:id recibe operationId, expectedVersion (0 para primera configuración), amount (decimal no negativo hasta seis decimales o null) y reason. Dueño + settings.manage; versión optimista, auditoría y acuse idempotente en la misma transacción. Cero es explícito; null conserva «sin configurar».

Cada edición agrega una versión inmutable. El snapshot nuevo incluye commissions con productId/version/amount. Comisión por línea: importe unitario × cantidad × importe después de descuentos / importe bruto; redondeo por línea al peso, empate arriba. Canje no modifica el descuento, ni propina ni domicilio generan comisión. Descuento total con importe bruto cero produce comisión cero cuando existe una regla explícita.

## Versiones de sincronización y selección

La autorización acepta sellerSupport=true. Solo esos clientes reciben sellers/commissions en el snapshot; clientes anteriores conservan su proyección y colas. Se amplían los contratos de respuesta y snapshot con campos opcionales. Los snapshots nuevos tienen otra identidad de contenido sin reescribir los anteriores.

orders-v4 conserva los eventos existentes y exige sellerId/sellerSnapshotId en sale.split. v1/v2/v3 siguen aceptados sin inventar identidad. El nuevo motor de navegador exige selección para cobrar y produce payloadVersion=4. Dominio/servidor reconstruyen vendedor y comisiones desde su snapshot de la misma sucursal/equipo, validado temporalmente, y nunca aceptan importes o nombres declarados por el cliente. Un cobro pendiente conserva su versión aunque luego se desactive o reasigne al vendedor.

IndexedDB conserva lastSellers por actor en el perfil de cada caja; se actualiza atómicamente con la venta confirmada. La interfaz muestra la selección recordada si sigue disponible; con un único vendedor puede seleccionarlo automáticamente. Sin vendedores disponibles, se indica al dueño cómo configurarlos y se impide confirmar nuevos cobros desde el nuevo cliente; consultas, pedidos, turnos, cierre y colas conservan su funcionamiento.

Venta nueva conserva sellerId/sellerName/sellerVersion/sellerSnapshotId y commissionLines (lineId/productId/quantity/unitAmount/ruleVersion/amount), commissionKnown, commissionPending y commissionAmount nullable. No modifica efectivo esperado, pagos, puntos ni consumo.

Devolución nueva conserva vendedor original y comisión revertida. El importe de comisión se revierte por proporción acumulada de cantidades, restando lo ya devuelto y redondeando para que la devolución completa sea exacta. Propina se revierte por su importe efectivamente devuelto. No asignar devoluciones al último vendedor seleccionado ni a quien opera el turno de devolución.

## Informes

GET /api/seller-options?branchId=… devuelve opciones por alcance autorizado, incluyendo identidades históricas de ventas aunque estén desactivadas o reasignadas. No entrega otras sucursales fuera del alcance.

reports/sales y reports/sellers admiten sellerId; unassigned selecciona ventas sin vendedor. El nuevo informe agrupa por ID estable y muestra cantidades de cobros/devoluciones, productos netos tras descuentos/devoluciones, propinas y domicilios netos y comisiones conocidas/pendientes. Las devoluciones se incluyen por fecha propia en America/Bogota, incluso si la venta original está fuera del período. La venta original conserva su nombre histórico.

Comisiones no configuradas conservan null. El resumen muestra total nullable y suma conocida separada; cantidades pendientes totalmente devueltas se cancelan en el mismo período. El detalle de ventas y Excel conservan los datos de cada producto/versión. Exportación de vendedores incluye todas las filas agregadas filtradas, aunque la pantalla esté paginada; el detalle por venta está disponible en el informe de Ventas con el mismo filtro.
