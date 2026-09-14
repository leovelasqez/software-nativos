# Secuencia de entrega propuesta

La secuencia organiza el trabajo, sin fechas fijadas. Implementación local autorizada por el usuario el 13-09-2026. Incrementos 0 y 1 completados en sus alcances; siguiente: incremento 2. Ver evidencia de [fundamentos](evidence/increment-1.md). Dividir módulos grandes en incrementos con escenarios completos; no construir todas las pantallas antes de comprobar persistencia y sincronización.

| Incremento | Resultado verificable | Specs / dependencias |
| --- | --- | --- |
| 0. Especificación base — completado | Resolver decisiones que bloquean identidad, permisos, datos locales y contratos de cobro/sincronización; preparar plan y tareas. | 001 y diseño inicial de 007; DEC-002/003/004/014 según alcance. |
| 1. Fundamentos — completado localmente | Usuarios, sucursales, permisos aplicados por servidor, shell accesible claro/oscuro y auditoría. | 001; contrato de autorización offline de 007. |
| 2. Catálogo y existencia | Alta de producto, receta válida, bodega, movimiento inicial y trazabilidad. | 002, 003 y 001; costo condicionado a DEC-004/005. |
| 3. Primera venta completa | Abrir turno, agregar producto terminado/preparado, cobrar localmente, descontar, emitir comprobante y sincronizar sin duplicar. | 004, 006, 007; Consumidor final basta para este primer flujo. |
| 4. Operación de pedidos | Clientes online, mesas, división, pagos combinados, edición, cancelación, propina, desperdicio y devolución. | 004, 005 (clientes), 006; decisiones de cálculo cerradas. |
| 5. Fidelización | Inscripción, acumulación, canje central seguro, comprobante y reversión; probar cortes durante canje. | 005; contratos de 004/007 y DEC-006/007. |
| 6. Administración completa | Compras/traslados/conteos, informes, costos autorizados, Excel y respaldos verificados. | 003, 008, 011. |
| 7. Integraciones | WhatsApp por eventos confirmados y API/MCP con permisos e importación idempotente. | 009, 010; dominio e informes ya verificables. |
| 8. Migración y lanzamiento | Historia conciliada, inventario físico inicial, hardware probado, recuperación ensayada y arranque conjunto. | 011 y aceptación cruzada de todos los módulos. |

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
