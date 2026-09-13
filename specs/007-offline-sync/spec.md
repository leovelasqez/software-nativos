# 007 — Operación local, sincronización y recuperación

Estado: incremento 0 verificado en dominio/contratos; capacidad completa pendiente. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, sección 14.

## Requisitos

- REQ-007-01: caja instalada con persistencia local de pedidos, ventas y turnos; sobrevivir cierre de aplicación y reinicio de Windows.
- REQ-007-02: cobro, pagos, consumo y caja atómicos localmente; enviar operaciones únicas con reintentos y eliminar pendientes solo después de acuse confirmado.
- REQ-007-03: acceso offline hasta siete días para usuarios/equipos previamente autorizados; recibir cambios y revocaciones al reconectar.
- REQ-007-04: preservar versiones de precios/recetas en ventas offline, reconciliar sin duplicar y mostrar última sincronización por local.
- REQ-007-05: offline permite ventas, pedidos, descuentos, propinas, cancelaciones y caja; bloquea altas de productos/clientes/recetas, compras, traslados, configuración y canjes. Puntos ganados quedan pendientes.
- REQ-007-06: impresión y respaldos no deben repetir cobros; actualizaciones de aplicación/esquema local deben preservar operaciones pendientes.

## Escenarios de fallo a diseñar

Interrupción antes y después del commit local; commit central con respuesta perdida; acuse recibido y limpieza local interrumpida; descarga de catálogo parcial; desorden causal entre compras, ventas y cierres; canje central confirmado con fallo local; reloj incorrecto; expiración offline; actualización con pendientes.

No basta una bandera «online». El contrato debe describir estados de operación local, acuse, error recuperable, rechazo que requiere conciliación y versión incompatible. Las operaciones comerciales se conservan mientras se resuelve el estado.

## Aceptación

Política confirmada de expiración: al agotar siete días sin validación online, bloquear nuevos cobros hasta reconectar y conservar consulta autorizada, pedidos guardados y cierre del turno existente. La expiración no borra datos ni pendientes.

- AC-007-01 → REQ-007-01/02. Dado un fallo antes del commit local, cuando se reinicia, entonces no existe una venta parcialmente cobrada o parcialmente descontada; después del commit, la operación completa sí se recupera.
- AC-007-02 → REQ-007-02. Dado un commit central exitoso cuya respuesta se perdió, cuando se reintenta, entonces el servidor reconoce la operación y no repite efectos.
- AC-007-03 → REQ-007-03/05. Dado un equipo previamente autorizado dentro del plazo, cuando no hay internet, entonces se permiten las acciones offline acordadas y se bloquean altas/canjes. Los límites de expiración deben probarse con la política resuelta en DEC-003.
- AC-007-04 → REQ-007-04/05. Dado un catálogo actualizado durante un corte, cuando llegan ventas previas y puntos pendientes, entonces se respetan sus versiones y no se recalculan con el catálogo nuevo.
- AC-007-05 → REQ-007-06. Dada una impresora fallida o una actualización de esquema, cuando se recupera el servicio, entonces no se pierden pendientes ni se repite el cobro.

- AC-007-06 → REQ-007-01/03/05. Dado un equipo que agotó siete días sin validación online, cuando intenta cobrar, entonces se bloquea el nuevo cobro; consultar datos autorizados y cerrar su turno siguen disponibles y no se pierden pedidos ni transacciones pendientes.

## Dependencias y pendientes

Contrato base de identidad y envoltura definido con 001; completar payload con 004/005/006; implementar un primer flujo vertical antes de expandir. DEC-003/004/007/008/012 son relevantes. Evidencia de resistencia a fallos y restauración: pendiente.

## Límite de recuperación confirmado

Solo existe el computador del local, sin segundo dispositivo de respaldo offline. Las copias locales en el mismo disco no cubren su pérdida total. Diseñar y probar por separado recuperación de errores lógicos, reinicios y restauración central; esta última solo cubre operaciones sincronizadas. No comprometer pérdida cero de datos aún locales. Frecuencia, retención y tiempos de recuperación siguen pendientes de diseño en DEC-012.

## Alcance entregado — Incremento 0

Ver [plan](plan.md), [tareas](tasks.md) y [evidencia](../../docs/evidence/increment-0.md). Se ejecutaron pruebas de políticas y esquemas; los AC originales que requieren servidor, almacenamiento, UI o reinicios NO están acreditados integralmente. No hay operación comercial real.
