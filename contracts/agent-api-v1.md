# Contrato v1 — API y MCP de agentes

Estado: contrato local verificado del incremento 7A. El documento consumible OpenAPI 3.1 es `agent-api-v1.json`. Todas las operaciones son online y usan `Authorization: Bearer <token>`; el token es opaco, revocable y no se registra ni devuelve después de su creación.

## Identidad y permisos

Un dueño crea (`POST /api/agents`), rota (`POST /api/agents/{id}/rotate`) o revoca (`PATCH /api/agents/{id}`) una credencial con `id`, nombre, sucursales y acciones explícitas. El servidor guarda solo SHA-256 del token y resuelve un principal `agent`; aplica `active`, sucursal y acción en cada llamada. El token sólo está presente en la respuesta de creación o rotación. El rol no concede permisos adicionales: `cost.read`, `cost.write` y `loyalty.adjust` siguen sujetos al límite de dueño. Un agente no recibe concesión offline, cookie de usuario ni acceso a SQL.

## Consultas

`GET /api/agent/v1/products`, `/recipes`, `/inventory`, `/movements` y `/reports/{kind}` requieren `branchId`, aplican cursor/`limit` y retornan solo proyecciones permitidas. Informes devuelven el mismo contexto `lastSynchronizedAt` por sucursal que la API web. Inventario y movimientos excluyen entrada de costo y costo unitario. No incluyen credenciales, hashes, claves POS, costos ni márgenes para una identidad sin permiso.

## Importaciones

`POST /api/agent/v1/imports/preview` acepta `contracts/agent-import-v1.schema.json` y devuelve cada error como `{row,field,code,message}` junto al `previewFingerprint`. No persiste hechos comerciales. `POST /api/agent/v1/imports/confirm` requiere el mismo cuerpo y fingerprint; aplica el lote completo o nada. Repetir el mismo `operationId`, actor y contenido devuelve el resultado original; cambiar el contenido devuelve `409 operation_conflict`.

Cada confirmación crea un documento inmutable de importación y sus movimientos causales: `initial` para saldo inicial único, `entry` para entrada de inventario importada, y `adjustment_in`/`adjustment_out` para corrección explícita. Las cantidades son positivas; el signo se deriva del tipo. No se simula una compra ni se introduce costo, proveedor o medio de pago cuando el archivo no los contiene.

La importación de catálogo/recetas se define por separado en `agent-catalog-import-v1.md`: crea únicamente productos nuevos, sus artículos terminados y recetas activas validadas en la misma transacción.

## MCP

`POST /api/agent/v1/mcp` acepta JSON-RPC 2.0 con Bearer token en cada llamada. Implementa `initialize`, `tools/list` y `tools/call`; las herramientas fijas son `nativos_products_list`, `nativos_recipes_list`, `nativos_inventory_list`, `nativos_movements_list`, `nativos_report_get` y las cuatro operaciones `nativos_{inventory,catalog}_import_{preview,confirm}`. Sus argumentos y resultados delegan a las rutas documentadas arriba, por lo que una denegación HTTP se devuelve como contenido MCP con `isError: true` y no puede eludir permisos. No existe herramienta de SQL, shell, archivos arbitrarios ni ejecución de URLs.
