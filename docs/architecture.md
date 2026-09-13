# Arquitectura propuesta

Estado: base modular aceptada técnicamente para implementación local autorizada (13-09-2026). Adaptadores aún pendientes. Las decisiones adicionales se registran en [decisions.md](./decisions.md).

## Enfoque inicial

Proponer un servidor modular único y una caja local con almacenamiento propio. Para dos locales, esto permite separar responsabilidades sin asumir el costo operativo de microservicios. Escalar componentes solamente cuando mediciones y necesidades concretas lo justifiquen. Esta elección queda aceptada técnicamente en DEC-001/015.

Tecnologías propuestas en el plan: web React/TypeScript, caja Electron/SQLite y servidor Node.js/TypeScript/PostgreSQL. Versiones y librerías se fijarán después de verificar compatibilidad, especialmente Windows, impresión y almacenamiento local.

## Responsabilidades

| Área | Es responsable de | No debe hacer |
| --- | --- | --- |
| Identidad y sucursales | Usuarios, permisos, equipos y acceso offline | Confiar solo en controles visuales |
| Catálogo y recetas | Presentaciones, precios, versiones y conversiones | Cambiar una receta histórica de una venta |
| Pedidos y ventas | Pedido, descuentos, pago, comprobante y devoluciones | Escribir saldos sin movimientos trazables |
| Inventario y compras | Movimientos, existencias, costos y traslados | Tratar costo desconocido como cero |
| Caja | Turnos y movimientos por medio de pago | Mezclar cobro digital con efectivo disponible |
| Fidelización | Libro de puntos, reglas y reservas/canjes | Aceptar canjes offline |
| Sincronización | Cola local, acuses, versiones y reconciliación | Descartar pendientes antes del acuse |
| Informes | Consultas y exportaciones autorizadas | Recalcular operaciones históricas con reglas actuales |
| Integraciones | WhatsApp, importación Alegra y MCP | Saltarse reglas del dominio |

## Datos y consistencia

- La caja confirma localmente la transacción que contiene venta, pagos, consumo y caja. El diseño deberá precisar cómo se coordina el canje online de puntos con esa transacción local.
- La sincronización usa identificadores estables, control de repetición y acuses. El objetivo comprobable es un solo efecto comercial por operación, incluso con múltiples entregas.
- El servidor conserva la vista consolidada y el estado de actualización de cada local. Los reportes no ocultan la antigüedad de los datos.
- Precios, impuestos, receta, sustituciones y reglas aplicadas se conservan con la operación; su representación exacta se definirá en los contratos.
- Los datos de costo no deben llegar a usuarios no autorizados. Límite definido en DEC-004/015: costeo central y proyecciones públicas sin costos en caché POS; integración por implementar.
- La consulta y el cobro no dependerán de la disponibilidad de WhatsApp. Los envíos se procesan a partir de operaciones comerciales confirmadas.

## Contratos que deben existir antes del código dependiente

1. Identidad: actor, equipo, sucursal, permisos y validez offline.
2. Catálogo: producto, presentación, receta/versiones, unidades, sustituciones y precios.
3. Venta: líneas, descuentos, impuestos, propina, envío, pagos, comprobante, devolución y vínculo con turno.
4. Inventario: tipos de movimiento, unidad base, bodega y referencia de origen.
5. Puntos: acumulación, canje, reserva/confirmación/cancelación y devolución.
6. Sincronización: operación, orden causal, versión, acuse, reintento, errores y conflictos.
7. Exportación y trabajos externos: filtros, permisos, estado y acceso al resultado.

Crear contratos OpenAPI para la API y esquemas versionados para datos/eventos de sincronización cuando se refine cada interfaz. Los adaptadores MCP deben reutilizarlos. No fijar endpoints o campos arbitrarios antes de resolver las transacciones que representan.

## Seguridad y operación

Definir manejo de credenciales, almacenamiento protegido de autorizaciones offline, revocación al reconectar y separación de permisos. Un usuario con acceso al archivo de la caja no debe obtener costos que el producto le prohíbe consultar mediante una simple exportación del caché.

Registrar métricas y errores por operación con datos personales mínimos. Diseñar respaldo, restauración, actualización de esquema local y compatibilidad temporal entre clientes y servidor. No actualizar una caja de forma que pierda operaciones aún no sincronizadas.

El alojamiento en Render sigue siendo una propuesta. Contratación, presupuesto, capacidad, retención y objetivos de recuperación continúan pendientes.

## Implementación local del incremento 0

`src/contracts.ts` valida esquemas y restricciones semánticas. `src/authorization.ts` evalúa permisos y proyección pública. `src/sync.ts` verifica acuses y transiciones sin almacenamiento. `tests/` prueba únicamente esos límites. Ninguno autentica, abre sockets, cobra ni persiste datos. Adaptadores de API, caja y exportaciones deberán consumir estas políticas y añadir pruebas de integración.
