# Contrato v1 — API y MCP de agentes

## Ampliación de consulta — 15-10-2026

- `GET /api/agents`: sólo dueño con `settings.manage`; lista agentes completamente dentro de sus sucursales: `{items:[{id,name,branchIds,actions,active,createdAt,rotatedAt}]}` sin token/hash. `active` combina usuario y credencial.
- `POST /api/agents/read-only`: sólo dueño; `{name,branchIds,reason}` con las mismas restricciones de creación existentes; fija `actions:["data.read"]` en servidor y devuelve `{id,name,branchIds,actions,token}` una sola vez. Renovar/revocar reutiliza rutas existentes.
- `GET /api/agent/v1/context`: Bearer con `data.read`; `{agent:{id,name},generatedAt,branches:[{id,name,lastSynchronizedAt,warehouses:[{id,name}]}]}`. Sólo sucursales asignadas. `lastSynchronizedAt:null` significa sin sincronización registrada, no ausencia de pendientes.
- `POST /api/agent/v1/mcp/read-only`: MCP Streamable HTTP stateless del SDK oficial, JSON, sin `X-Nativos-Request`, manteniendo Host/Origin. Autenticación Bearer por petición; nunca cookie. GET/DELETE responden 405. Admite inicialización, notificaciones y herramientas del SDK. Descubre y permite sólo `nativos_context_get`, `nativos_products_list`, `nativos_recipes_list`, `nativos_inventory_list`, `nativos_movements_list`, `nativos_report_get` cuando tiene `data.read`. La ruta MCP histórica conserva importaciones según permisos.
- Herramientas de consulta: argumentos de objeto estrictos; `branchId` obligatorio salvo contexto, `after` y `limit` (entero 1–100 o representación decimal para compatibilidad); productos añade `q`; informes requiere `kind` (`sales`, `sellers`, `cash`, `inventory`, `purchases`, `waste`, `loyalty`) y admite `from`, `to`, `productId`, `customerId`, `supplierId`, `paymentMethod`, `sellerId`. Cada tipo de informe valida sus filtros por API, en zona America/Bogota. La respuesta conserva `nextCursor`, totales y contexto de sincronización originales.
- Errores de dominio de herramienta: contenido MCP `isError:true`, sin excepciones/secretos internos; argumentos desconocidos o inválidos no se ejecutan. Anotaciones de consulta `readOnlyHint:true`, `destructiveHint:false`, `idempotentHint:true`, `openWorldHint:false`. La anotación no sustituye la autorización del servidor.

Estado: contrato local verificado del incremento 7A. El documento consumible OpenAPI 3.1 es `agent-api-v1.json`. Todas las operaciones son online y usan `Authorization: Bearer <token>`; el token es opaco, revocable y no se registra ni devuelve después de su creación.

## Identidad y permisos

Un dueño crea (`POST /api/agents`), rota (`POST /api/agents/{id}/rotate`) o revoca (`PATCH /api/agents/{id}`) una credencial con `id`, nombre, sucursales y acciones explícitas. El servidor guarda solo SHA-256 del token y resuelve un principal `agent`; aplica `active`, sucursal y acción en cada llamada. El token sólo está presente en la respuesta de creación o rotación. El rol no concede permisos adicionales: `cost.read`, `cost.write` y `loyalty.adjust` siguen sujetos al límite de dueño. Un agente no recibe concesión offline, cookie de usuario ni acceso a SQL.

## Consultas

`GET /api/agent/v1/products`, `/recipes`, `/inventory`, `/movements` y `/reports/{kind}` requieren `branchId`, aplican cursor/`limit` y retornan solo proyecciones permitidas. Informes devuelven el mismo contexto `lastSynchronizedAt` por sucursal que la API web. Inventario y movimientos excluyen entrada de costo y costo unitario. No incluyen credenciales, hashes, claves POS, costos ni márgenes para una identidad sin permiso.

Revisión 09-10-2026: el cursor de inventario es `warehouseId:itemId` y se valida como dos identificadores, exclusivamente en esa ruta. Se ordena y compara por ese mismo valor compuesto. Productos, recetas e inventario operativos excluyen registros archivados. Los eventos de importación usan `actor_kind=agent`; no se reescribe auditoría histórica. Un saldo inicial `import_initial` se puede revertir mediante la misma ruta autorizada y causal que un `initial`, permitiendo corregirlo sin eliminar el documento de importación.

## Importaciones

`POST /api/agent/v1/imports/preview` acepta `contracts/agent-import-v1.schema.json` y devuelve cada error como `{row,field,code,message}` junto al `previewFingerprint`. No persiste hechos comerciales. `POST /api/agent/v1/imports/confirm` requiere el mismo cuerpo y fingerprint; aplica el lote completo o nada. Repetir el mismo `operationId`, actor y contenido devuelve el resultado original; cambiar el contenido devuelve `409 operation_conflict`.

Cada confirmación crea un documento inmutable de importación y sus movimientos causales: `initial` para saldo inicial único, `entry` para entrada de inventario importada, y `adjustment_in`/`adjustment_out` para corrección explícita. Las cantidades son positivas; el signo se deriva del tipo. No se simula una compra ni se introduce costo, proveedor o medio de pago cuando el archivo no los contiene.

La importación de catálogo/recetas se define por separado en `agent-catalog-import-v1.md`: crea únicamente productos nuevos, sus artículos terminados y recetas activas validadas en la misma transacción.

## MCP

`POST /api/agent/v1/mcp` usa Streamable HTTP stateless del SDK oficial, JSON-RPC 2.0 y Bearer token en cada llamada. El SDK atiende `initialize` y notificaciones; se implementan `tools/list` y `tools/call`. Las herramientas son `nativos_context_get`, `nativos_products_list`, `nativos_recipes_list`, `nativos_inventory_list`, `nativos_movements_list`, `nativos_report_get` y las cuatro operaciones `nativos_{inventory,catalog}_import_{preview,confirm}`, filtradas por permisos. Sus argumentos y resultados delegan a las rutas documentadas arriba, por lo que una denegación HTTP se devuelve como contenido MCP con `isError: true` y no puede eludir permisos. No existe herramienta de SQL, shell, archivos arbitrarios ni ejecución de URLs. La conexión exclusiva de consulta usa `/api/agent/v1/mcp/read-only` y nunca publica ni ejecuta importaciones.
