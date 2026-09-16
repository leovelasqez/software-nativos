# Contrato de fidelización v1

> Contexto histórico de incrementos 0–5. Para cambios nuevos prevalecen DEC-021 y specs/012-unified-web: un sitio único con Caja offline en navegador. Se conservan reglas y contratos comerciales.
Estado: verificado localmente. Autorización: usuario solicita continuar con el siguiente incremento después de cerrar el 4. REQ-005-03/04/05/06; AC-005-01 a 08 (Excel en incremento 6), AC-004-06/07 y REQ-007-01/02.

## Diseño
Módulo independiente de fidelización. Inscripción online sobre cliente existente por cualquier usuario autorizado; regla inicial 1000 COP/punto, 10 COP/punto, máximo 20%, sin vencimiento. Dueño cambia equivalencias/límite mediante versión nueva y ajusta saldo con motivo. Libro central inmutable; saldos negativos válidos tras devoluciones y ajustes, canje siempre exige disponibilidad. Histórico v1/v2 y ventas previas a inscripción no generan puntos retroactivos. Configurar vencimiento no forma parte del régimen inicial sin vencimiento.

La caja guarda caché de miembros/saldos/versiones junto a fecha de consulta; distingue confirmado conocido y puntos pendientes locales. Solo genera puntos para inscripción conocida al cobrar, con regla vigente en su caché. El servidor conserva y verifica esa versión y fecha. Acumulación por compra: floor(productos netos tras descuentos y canje / umbral), excluyendo propina y domicilio. Propina porcentual se calcula antes del canje. Dinero de productos tras canje se reparte proporcionalmente entre líneas a seis decimales; pesos efectivamente pagados se asignan por mayores restos con desempate estable. En devoluciones, dinero solo desde paidAmount de cada línea; puntos generados/usados se revierten/restituyen proporcionalmente al valor neto de los productos devueltos acumulados, redondeando a entero con empate arriba y tomando diferencia contra devoluciones previas. Reembolso completo devuelve/resta exactamente los puntos originales; nunca se convierten puntos a dinero.

## Canje y recuperación — DEC-020
Elegir confirmación central del cobro completo en una sola transacción en vez de reservas temporales: después de vaciar outbox, validar y persistir intención local inmutable con operación/secuencia/payload/grant, sin cobrar aún. Mientras existe intención, bloquear otras mutaciones de esa caja. Servidor confirma venta, descuento de puntos, acumulación, inventario, caja y acuse atómicos bajo lock compartido. Después del acuse, aplicar idéntico comando local en una transacción y retirar intención. Pérdida de respuesta/reinicio reenvía misma operación hasta recuperar acuse; no libera ni descuenta otra vez. No se promete completar canje sin conexión. Una cancelación explícita consulta/serializa centralmente: si ya cobró, se recupera el cobro; si no, tombstone impide que una solicitud tardía confirme y libera intención sin consumir secuencia. Un resultado incierto permanece visible y bloqueado hasta reconectar; lectura e historial conservados.

## Contratos y migración
Migración PostgreSQL 005 aditiva, SQLite nuevas tablas/caché/intención con checksum propio sin editar SQL aplicado. Extender envoltura para payloadVersion 3 y esquema orders-v3, preservar v1/v2. Lo calculado proviene de regla/miembro central verificables. Respuestas de authorize añaden caché de fidelización opcional para compatibilidad. API autenticada /api/loyalty para listado/historia, inscripción, ajustes y versiones; token de terminal + concesión firmada de la operación para cancelación de intención, incluso en recuperación histórica. Cliente POS envía puntos deseados, nunca saldo o regla arbitrarios. Esquemas cerrados; idempotencia por actor/contenido. Exportación Excel en 008/incremento 6.

## Verificación
Dominio casos AC-005-02/06/07/08, reparto, límites y redondeos; integración SQLite/PostgreSQL/DPAPI: permisos, idempotencia, canjes concurrentes, pérdida de respuesta/reinicio/cancelación, saldo negativo sin bloquear venta, reglas históricas y no retroactividad. E2E inscripción, consulta, canje, comprobante, devolución, temas/móvil/teclado/axe, evidencia separada incremento 5. Reiniciar servicios de desarrollo conservando configuración, sin datos reales de prueba.

## API implementada

- GET `/api/loyalty?branchId=...`: regla actual, miembros y saldos globales confirmados con `asOfMs`. No incluye operaciones pendientes de las cajas. Requiere sesión y acceso a la sucursal.
- GET `/api/loyalty/history?branchId=...&customerId=...&after=...`: movimientos del cliente en la sucursal autorizada, páginas de 100 y `nextCursor`; saldo posterior global histórico de cada movimiento.
- POST `/api/loyalty/enroll`: `operationId`, `branchId`, `customerId`; inscripción única sin reiniciar saldo.
- POST `/api/loyalty/adjust`: anteriores más `delta` entero firmado y `reason`; solo dueño autorizado, variación distinta de cero y motivo significativo.
- POST `/api/loyalty/rules`: `operationId`, `branchId`, `earnEvery`, `pointValue`, `maxPercent`, `reason`; solo dueño autorizado, nueva versión sin modificar comprobantes anteriores.
- POST `/api/pos/sync`: envoltura existente con payloadVersion 3 para cobro/devolución con puntos. Conserva secuencia, hash y acuse exactos; los payloads 1/2 no generan puntos retroactivos.
- POST `/api/pos/redemption/cancel`: terminal autenticado y concesión firmada correspondiente. Serializa cancelación y cobro; un cobro ya confirmado se recupera. No amplía la autorización para iniciar ventas nuevas.
- Caja local: `/api/pos-local/loyalty/enroll`, `/refresh` y `/resolve` con `cancel` booleano. La recuperación pertenece al usuario de la intención guardada.

Contratos ejecutables: `loyalty-v1.schema.json`, `orders-v3.schema.json`, `pos-api-v1.json` y `sync-v1.schema.json`. Evidencia: [incremento 5](../docs/evidence/increment-5.md).
