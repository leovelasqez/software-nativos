# Secuencia de entrega propuesta

La secuencia organiza el trabajo, sin fechas fijadas. Implementación local autorizada por el usuario el 13-09-2026. Incrementos 0–5 completados en sus alcances; se incorpora transición 5W al sitio único antes del incremento 6. Ver evidencia de [fundamentos](evidence/increment-1.md). Dividir módulos grandes en incrementos con escenarios completos; no construir todas las pantallas antes de comprobar persistencia y sincronización.

| Incremento | Resultado verificable | Specs / dependencias |
| --- | --- | --- |
| 0. Especificación base — completado | Resolver decisiones que bloquean identidad, permisos, datos locales y contratos de cobro/sincronización; preparar plan y tareas. | 001 y diseño inicial de 007; DEC-002/003/004/014 según alcance. |
| 1. Fundamentos — completado localmente | Usuarios, sucursales, permisos aplicados por servidor, shell accesible claro/oscuro y auditoría. | 001; contrato de autorización offline de 007. |
| 2. Catálogo y existencia — completado localmente | Alta de producto, receta válida, bodega, movimiento inicial y trazabilidad. | 002, 003 y 001; costo condicionado a DEC-004/005. |
| 3. Primera venta completa — completado localmente | Abrir turno, agregar producto terminado/preparado, cobrar localmente, descontar, emitir comprobante y sincronizar sin duplicar. | 004, 006, 007; Consumidor final basta para este primer flujo. |
| 4. Operación de pedidos — completado localmente | Clientes online, mesas, división, pagos combinados, edición, cancelación, propina, desperdicio y devolución. | 004, 005 (clientes), 006; decisiones de cálculo cerradas. |
| 5. Fidelización — completado localmente | Inscripción, acumulación, canje central seguro, comprobante y reversión; probar cortes durante canje. | 005; contratos de 004/007 y DEC-006/007. |
| 5W. Sitio web único — verificado localmente | Administración/Caja en un origen, persistencia offline navegador, pestañas concurrentes y traslado de datos anteriores. | 012, 001, 004, 005, 006, 007, 011; DEC-021. |
| 6. Administración completa | Compras/traslados/conteos, informes, costos autorizados, Excel y respaldos verificados. | 003, 008, 011. |
| 7. Integraciones | WhatsApp por eventos confirmados y API/MCP con permisos e importación idempotente. | 009, 010; dominio e informes ya verificables. |
| 8. Migración y lanzamiento | Historia conciliada, inventario físico inicial, hardware probado desde navegador, recuperación ensayada y arranque conjunto. | 011 y aceptación cruzada de todos los módulos. |

Los contratos de sincronización se diseñan desde el incremento 0 y se validan con la primera venta del incremento 3. Esto evita intentar agregar offline al final y no crea una dependencia circular: primero se define la frontera, después se implementa cada lado.

## Tareas documentales inmediatas

- [x] TASK-DOC-01: resolver el alcance del primer incremento y las decisiones bloqueantes de 001/007; actualizar DEC-001 a DEC-004 según corresponda.
- [x] TASK-DOC-02: detallar contratos de identidad, permisos y autorización de equipo; asociar AC-001-01 a AC-001-04 y AC-007-03.
- [x] TASK-DOC-03: especificar el protocolo de una venta local y su acuse, incluidos repetición y fallo parcial; asociar AC-007-01/02/04.
- [x] TASK-DOC-04: completar el plan técnico y tareas del primer incremento mediante las plantillas; implementar políticas locales bajo autorización del 13-09-2026.

Casillas documentales cerradas con planes/contratos 001/007 y [evidencia](evidence/increment-0.md). Esto no acredita transacciones, persistencia, UI ni sincronización real. DEC-002/014 de reparto se difieren antes del payload de cobro en incremento 3; no bloquean el incremento 1.

## Criterio de paso entre incrementos

Requisitos trazados, contratos coherentes, pruebas y evidencia del alcance completadas y ausencia de bloqueantes que invaliden el siguiente incremento. Permitir trabajo documental o técnico independiente ya autorizado mientras otro componente espera un dato externo.

## Cierre del incremento 1

Usuarios, permisos por sucursal en servidor, auditoría atómica y shell React accesible verificados contra PostgreSQL real y navegador. El alcance online de fundamentos está listo; productos/ventas/exportaciones y firma/custodia offline permanecen en sus incrementos. AC-001-02/03 comerciales no se acreditan integralmente. Evidencia: `docs/evidence/increment-1.md`.

## Cierre del incremento 2

Productos terminados/preparados y versiones, recetas borrador/activas y opciones, artículos, iniciales/reversiones, mínimos y costos iniciales restringidos verificados en PostgreSQL y navegador. [Evidencia](evidence/increment-2.md). El consumo por venta, conservación de pedidos, compras, costeo promedio y respaldo operativo permanecen pendientes en sus incrementos; no se presentan pruebas de dominio como cobros reales.


## Cierre del incremento 3

Primera venta completa a Consumidor final: turno propio, terminado/preparado con opciones, pago único manual, consumo al cobrar, comprobante persistido y copia, cierre con diferencia, sincronización única y autorización offline firmada. SQLite/DPAPI y PostgreSQL reales, reinicios, fallo antes del commit, pérdida de acuse, permisos/expiración/revocación, Edge y Electron probados. [Evidencia](evidence/increment-3.md). Las aceptaciones de compras, división/descuentos/devoluciones/puntos, hardware, respaldo operativo y mensajería permanecen en sus incrementos.


## Cierre del incremento 4

Clientes, pedidos múltiples, datos manuales de mesa/domicilio, notas y descuentos, comandas internas, cancelación preparada/desperdicio, división, medios combinados, propina/envío, devolución autorizada y cierre neto verificados. Dominio, PostgreSQL/SQLite/DPAPI, compatibilidad y Edge/Electron. [Evidencia](evidence/increment-4.md). Puntos siguen en incremento 5; seguimiento de reparto después de cerrar el pedido no está implementado.

## Cierre del incremento 5

Inscripción, saldo/historia, acumulación offline pendiente, canje central concurrente, comprobantes y devoluciones con puntos, reglas versionadas y ajustes exclusivos del dueño. Recuperación tras cortes y cancelación serializada verificadas con PostgreSQL/SQLite/DPAPI, Edge y Electron. [Evidencia](evidence/increment-5.md). Excel, respaldos operativos, compras y costeo promedio siguen en incremento 6.

## Cierre de la transición 5W

Sitio único, persistencia de Caja en navegador y conservación de datos previos verificados. [Evidencia](evidence/unified-web.md). El siguiente incremento funcional es 6, sobre esta arquitectura; hardware, respaldos operativos y lanzamiento siguen pendientes.
