# 020 — Vendedores en una misma cuenta de caja

Estado: Verificada localmente; publicación pendiente. Autorización: solicitud del usuario del 14-10-2026 de revisar el código, construir mediante SDD y probar antes de publicar en Railway.

## Objetivo y alcance

Varias personas cobran con una misma cuenta y turno, identificando por separado al vendedor para consultar ventas, propinas y comisiones. El usuario autenticado conserva permisos, responsabilidad de caja y auditoría. Un vendedor no es una credencial ni concede acceso.

## Requisitos

- REQ-020-01: el dueño administra vendedores independientes de usuarios, con nombre, estado y sucursales. Crear/editar/desactivar requiere conexión y motivo auditado; no borrar historia ni crear personas ficticias.
- REQ-020-02: seleccionar vendedor en cada cobro sin cambiar usuario ni abrir otro turno. Validar pertenencia a la sucursal; congelar identidad y regla aplicable en la venta. Recordar el último vendedor por cuenta/caja, permitir cambiarlo y exigir una selección válida para confirmar el cobro nuevo.
- REQ-020-03: conservar selección, importes e identidad al vender offline, recargar, dividir cuentas, reintentar, sincronizar o continuar el turno. Cada cobro dividido conserva su vendedor. La información histórica usa la versión descargada y no nombres/reglas actuales.
- REQ-020-04: devoluciones se atribuyen al vendedor de la venta original, aunque las registre otra persona. Evitar doble descuento ante repetición y preservar venta original. Revertir comisión según cantidad acumulada devuelta y propina según importe efectivamente devuelto.
- REQ-020-05: consultar ventas y resumen por vendedor, período y sucursal; separar productos, devoluciones, propinas, domicilios y comisiones. Exportar todas las filas filtradas a Excel con los mismos permisos y contexto de sincronización.
- REQ-020-06: conservar ventas y pendientes de versiones anteriores sin inventar vendedor o comisión; identificarlos como «Sin vendedor registrado». Migraciones aditivas, sin modificar importes ni atribuciones históricas.
- REQ-020-07: calcular comisiones según regla confirmada y congelada; las propinas siguen el reparto confirmado. No deducir comisiones del efectivo esperado ni registrar un pago de nómina por consultar el informe.

## Aceptación

- AC-020-01 → REQ-020-01. Dueño crea dos vendedores sintéticos y los asigna a Centro; cajero no puede administrarlos y usuarios de Milán no reciben vendedores exclusivos de Centro. Edición concurrente no sobrescribe cambios inadvertidamente.
- AC-020-02 → REQ-020-02/03. Dos cobros consecutivos con distintos vendedores mantienen el mismo usuario, turno y caja, y guardan la identidad de cada vendedor; selección inválida no persiste venta ni consumo.
- AC-020-03 → REQ-020-03. Cobro offline y su reintento sobreviven recarga y sincronización con respuesta perdida, produciendo una venta, consumo y atribución. Una cuenta dividida permite un vendedor por cobro.
- AC-020-04 → REQ-020-03/06. Cambiar nombre, estado, sucursal o regla después de descargar conserva el cobro offline basado en la versión anterior y la consulta de ventas anteriores. Venta sin datos nuevos sigue consultable sin atribución inventada.
- AC-020-05 → REQ-020-04/07. Devoluciones parciales acumuladas revierten los importes pertinentes del vendedor original, incluso si se registran en otro turno. La repetición no duplica importes y la devolución completa cuadra con el original.
- AC-020-06 → REQ-020-05. Informe por vendedor y fecha aplica alcance por sucursal, incluye devoluciones del período y exporta todas las filas. Totales del resumen coinciden con el detalle; no se cuentan dos veces propinas ni domicilios.
- AC-020-07 → REQ-020-06. Base existente y colas v1/v2/v3 se mantienen operativas tras migración; nuevos clientes distinguen registros sin vendedor. No se exige otro login ni otra apertura.
- AC-020-08 → REQ-020-02/05/07. Flujo real en navegador, escritorio/móvil y claro/oscuro, permite administrar, seleccionar, cobrar, consultar y exportar con teclado y sin recortes.

## Decisiones confirmadas — 14-10-2026

El usuario confirma comisión fija en COP por cada producto, aún sin importes definidos; se calcula después de descuentos y devoluciones. En aclaración explícita, una comisión sintética de $1.000 con descuento del 10% produce $900. Cada propina pertenece al vendedor de su venta. Recordar el último vendedor, permitiendo cambiarlo sin cambiar sesión.

Guardar importe de comisión por unidad en configuración versionada de cada producto, exclusiva del dueño. Vacío significa pendiente de configurar, distinto de cero. Fórmula: comisión unitaria × cantidad × importe de productos tras descuento / importe bruto. El canje de puntos es un medio de pago y no cambia el descuento. Propina/domicilio no generan comisión. Redondear por línea al peso, empate arriba; devoluciones por proporción acumulada de cantidad revierten exactamente la comisión original. El informe suma comisión conocida y muestra cuántas líneas siguen pendientes; no completa retroactivamente ventas antiguas al configurar un importe nuevo.

Los nuevos cobros de Caja requieren un vendedor activo de la sucursal y recuerdan el último por cuenta/sucursal en IndexedDB. Si solo hay un vendedor disponible puede seleccionarse automáticamente, siempre visible y modificable. Sin vendedores se muestra cómo configurarlos y se impide confirmar nuevos cobros en el nuevo cliente. Se conservan consultas, turnos, cierre, pedidos y sincronización de colas antiguas sin vendedor.

## Evidencia

[Pruebas aprobadas](../../docs/evidence/sellers-2026-10-14.md). Diseño en [plan](plan.md), entregables en [tareas](tasks.md), interfaces en [contrato](../../contracts/sellers-v1.md).
