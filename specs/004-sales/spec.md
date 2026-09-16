# 004 — Pedidos, ventas y comprobantes

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, sección 4.

## Requisitos

- REQ-004-01: atender mostrador, mesas, pedidos abiertos y domicilios manuales; conservar pedido al crear producto o cliente y permitir seleccionar Consumidor final o cliente registrado.
- REQ-004-02: editar/eliminar líneas, cantidad, presentación, adicionales, sustituciones y notas. Todos pueden descontar por porcentaje/valor sin aprobación; limitar el descuento al valor de la línea y no alterar catálogo ni impuesto configurado.
- REQ-004-03: cancelar antes de facturar con confirmación, sin aprobación de otro usuario; registrar motivo de pedidos enviados y consumo desperdiciado de unidades preparadas.
- REQ-004-04: dividir cuenta por productos y combinar efectivo, tarjeta, transferencia, Bre-B, Daviplata y Nequi. Registrar pagos manualmente; separar propina voluntaria y envío.
- REQ-004-05: confirmar cobro, consumo y caja atómicamente en la caja; descontar solo líneas cobradas, conservar versiones y emitir comprobante interno único. Comanda no descuenta; reimpresión no cobra.
- REQ-004-06: asociar puntos de cliente inscrito y reflejarlos en comprobante; gestionar devoluciones posteriores con permisos y movimientos relacionados, sin borrar venta original.

## Flujo y estados

Pedido editable → envío a preparación opcional → selección de líneas para cobro → confirmación → comprobante. Cancelación afecta exclusivamente lo no facturado. Las líneas pagadas no regresan a edición normal; sus correcciones se tramitan como devolución. El diseño debe precisar estados intermedios, pago parcial y fallo de un medio de pago.

Producto Terminado consume sus unidades; Preparado consume su receta y modificaciones. La cantidad pendiente de un pedido dividido debe quedar distinguible de lo ya cobrado. No usar un único indicador de «pagado» para todo el pedido si quedan líneas abiertas.

Reglas confirmadas en aclaración SDD: cada cobro dividido tiene su cliente, comprobante y puntos. Propina porcentual sobre productos tras descuentos, antes de canje y sin envío. El importe final se redondea al peso más cercano con precisión interna. Al cancelar o quitar unidades enviadas, el cajero identifica cuántas ya se prepararon para registrar desperdicio; las restantes no consumen ingredientes. No se requiere aprobación.

## Aceptación

- AC-004-01 → REQ-004-01/02. Dado un pedido con dos líneas, cuando se crea un cliente y se cambia un adicional en una línea, entonces se conserva el pedido, se selecciona el cliente y solo cambia esa línea.
- AC-004-02 → REQ-004-02/04. Dada una línea sintética de $10.000 y descuento de 10%, cuando se agrega una propina de $1.000, entonces productos netos son $9.000, propina $1.000 y total $10.000. El descuento no exige aprobación ni modifica el precio del catálogo.
- AC-004-03 → REQ-004-03. Dada una comanda con unidades ya preparadas, cuando el cajero cancela lo no facturado con motivo y cantidades, entonces se cancela sin aprobación y se registra el desperdicio correspondiente una sola vez.
- AC-004-04 → REQ-004-04/05. Dado un pedido dividido, cuando se cobran solo unas líneas mediante dos medios, entonces pagos suman el importe debido, solo esas líneas consumen inventario y las demás permanecen pendientes.
- AC-004-05 → REQ-004-05/06. Dado un cobro persistido cuyo envío se repite, cuando el servidor vuelve a recibirlo y luego se reimprime, entonces existe una sola venta, consumo y acumulación de puntos y el comprobante conserva su identidad.

Los importes de aceptación son datos sintéticos, no precios del catálogo real.

- AC-004-06 → REQ-004-04/06. Dados $20.000 en productos después de descuentos, $1.000 canjeados, $3.000 de envío y propina del 10%, cuando se calcula el cobro, entonces la propina es $2.000 y el total $24.000.
- AC-004-07 → REQ-004-04/06. Dado un pedido dividido entre dos clientes inscritos, cuando cada uno paga sus productos, entonces recibe un comprobante propio y solo los puntos de su cobro.
- AC-004-08 → REQ-004-03. Dadas tres unidades canceladas de una comanda de las cuales dos están preparadas, cuando el cajero registra las cantidades, entonces se contabiliza desperdicio por dos y se cancela una sin consumo, sin aprobación.
- AC-004-09 → REQ-004-04. Dados importes finales calculados internamente de $9.999,40 y $9.999,60, cuando se confirma cada cobro, entonces los importes exigidos son $9.999 y $10.000 respectivamente. La política de empate en medio peso se documentará en el contrato.

Regla confirmada de cambio: el dinero devuelto como cambio corresponde exclusivamente al componente de efectivo; no aceptar excedentes en medios digitales para devolverlos en efectivo.

- AC-004-10 → REQ-004-04. Dado un total de $20.000 y pago digital de $15.000, cuando se reciben $10.000 en efectivo, entonces se aplican $5.000 a la venta y se devuelven $5.000 de cambio. Un pago digital de $25.000 para ese total no se admite como pago con cambio de $5.000.

## Dependencias y pendientes

001/002/003/005/006/007. DEC-002, DEC-006, DEC-007 y DEC-014 requieren completar contratos de cálculo, canje y pago parcial; las reglas confirmadas de DEC-013 se conservan. Hardware: DEC-008. Emisión fiscal: DEC-009 antes de operar, sin fingir que un comprobante interno la sustituye.

Evidencia y contratos de implementación: pendientes.

## Venta con impuesto sin asignar

El campo de impuesto del catálogo puede permanecer vacío sin bloquear el cobro. Conservar esa ausencia en la versión de la línea y no calcular un impuesto para ella; no clasificarla automáticamente como exenta ni como tasa 0%.

- AC-004-11 → REQ-004-02/05; REQ-002-02/05. Dado un producto válido de precio final sintético $10.000 con impuesto vacío, cuando se cobra una unidad sin descuentos, puntos, propina ni envío, entonces el total es $10.000 y la venta conserva impuesto sin asignar. Si después se configura un impuesto en el catálogo, consultar, reimprimir o sincronizar la venta anterior conserva su estado e importes originales. Aplicar la misma regla online y offline con la versión local disponible.

## Incremento 3

AC-004-12 → REQ-004-01/02/05. Dado un turno propio y pedido persistente a Consumidor final, cobrar terminado/preparado con opciones mediante un medio, conservar comprobante/versiones y un único consumo/pago/caja ante reintento. Sin pedido dividido ni comanda en este incremento.

Alcance: primera venta completa de la hoja de ruta. Ver plan/tareas del incremento 3; restantes escenarios se conservan para incrementos 4/5/6/8.

Verificación del alcance de incremento 3: [evidencia](../../docs/evidence/increment-3.md). Los escenarios anteriores fuera de ese alcance permanecen pendientes.


## Incremento 4

Alcance implementado y verificado localmente. Consultar [plan](plan-increment-4.md), [tareas](tasks-increment-4.md) y [evidencia](../../docs/evidence/increment-4.md). No acredita puntos, ingresos/gastos/retiros manuales, mensajería, hardware ni la capacidad completa.

## Dirección vigente — sitio web único

La revisión del 15-09-2026 conserva estas reglas y sustituye el cliente de escritorio por módulos del mismo sitio web. Aplicar DEC-021 y [012](../012-unified-web/spec.md). Pruebas históricas de Electron/SQLite no sustituyen aceptación en navegador. Impresión, cajón y recuperación del perfil se verifican antes de operar; no exigir instalador de escritorio.
