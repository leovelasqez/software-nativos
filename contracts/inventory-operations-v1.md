# Contrato v1 — Operaciones de inventario (incremento 6)

Estado: diseño. Aplicable solo a Administración online.

## Reglas comunes

Toda mutación contiene `branchId`, UUID `operationId` y `reason` no vacío de al menos tres caracteres. El servidor autentica actor, limita la sucursal y serializa libro, respuesta idempotente y auditoría en una sola transacción. Repetir actor/ruta/cuerpo devuelve la respuesta original; reutilizar el identificador con otro contenido devuelve `409 operation_conflict`.

Importes y cantidades son cadenas decimales positivas con hasta seis posiciones. Las unidades de entrada se convierten con `toBase`; g/kg y ml/l son implícitas, otra conversión exige factor positivo y fuente. El contrato nunca transmite costo promedio, costo de receta o margen a un rol sin acceso explícito.

## Recursos

- `POST /api/suppliers`: crea proveedor con nombre, documento/contacto opcionales y sucursal propietaria.
- `GET /api/suppliers?branchId&after&limit&q`: lista paginada limitada a sucursal.
- `POST /api/purchases`: registra compra pagada con proveedor, fecha local, medio registrado, total declarado y líneas de artículo/cantidad/unidad/conversión/precio. El servidor recalcula total de líneas y agrega una entrada inmutable por línea.
- `GET /api/purchases?branchId&after&limit&from&to&supplierId`: lista compras de la sucursal. El actor con `purchase.read` recibe sus importes; los demás reciben `403`.
- `POST /api/transfers`: crea borrador entre bodegas de sucursales autorizadas.
- `POST /api/transfers/{id}/dispatch`: crea las salidas de despacho una sola vez.
- `POST /api/transfers/{id}/receive`: recibe cantidades por línea, hasta el saldo despachado; crea únicamente las entradas recibidas.
- `POST /api/warehouses/{id}/counts`: registra conteo físico. La diferencia contra saldo deriva un movimiento `adjustment_in` o `adjustment_out`, conservando conteo y motivo.

Los estados de traslado son `draft`, `dispatched`, `received`, `cancelled`; cancelación solo es válida en `draft`. Una recepción parcial mantiene `dispatched`. Las respuestas de lista tienen `{items,nextCursor}`; errores controlados: 400 formato/regla, 401 sesión, 403 permiso/sucursal, 404 referencia y 409 estado, versión o idempotencia conflictiva.
