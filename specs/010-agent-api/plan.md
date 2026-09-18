# Plan técnico — API y MCP para agentes, incremento 7A

Estado: preparado para implementación local. Fuente: `spec.md`, DEC-001, DEC-004, DEC-012 y arquitectura vigente de sitio web único.

## Incremento seleccionado

Se implementa primero una frontera online de agentes para consultas autorizadas y cargas masivas **atómicas**. Incluye identidades revocables, alcance explícito por sucursal, lectura paginada de catálogo/inventario/movimientos/reportes y vista previa/confirmación idempotente de importaciones de inventario y productos/recetas. El servidor MCP usa exactamente estas operaciones; no recibe acceso SQL ni credenciales de PostgreSQL.

Quedan fuera WhatsApp, conexión a Alegra, costos/márgenes bloqueados por DEC-005, credenciales reales de terceros, ejecución en segundo plano y cargas parciales. Una carga con cualquier fila inválida no persiste ninguna fila: la vista previa devuelve todos los errores por fila y la confirmación requiere que el resumen validado coincida. Esta política resuelve AC-010-02 sin inventar movimientos ni permitir efectos parciales silenciosos.

## Diseño

`agent_credentials` conserva solo el hash SHA-256 de un token aleatorio, identificador opaco, nombre, estado, acciones y sucursales. El token se revela únicamente al crear o rotar la credencial; revocar invalida todas las peticiones posteriores. La autenticación construye un principal `agent` y reutiliza `authorize`/`requireAccess`, incluidos los límites de `cost.read` y la prohibición de operaciones offline.

Las rutas `/api/agent/v1/*` llaman adaptadores de consulta que reutilizan las mismas proyecciones y reglas de los módulos de catálogo, inventario y reportes; no devuelven hashes, sesiones, claves POS, costos o márgenes sin permiso explícito. La capa MCP es un adaptador fino sobre la API de dominio y expone únicamente herramientas nombradas, con validación de esquema y paginación estable.

Las importaciones se representan por un `operationId`, actor y fingerprint del lote canónico. La vista previa no escribe hechos comerciales; la confirmación toma el lock transaccional existente, revalida permisos/referencias y aplica un documento de importación, movimientos causales, auditoría e idempotencia en un solo commit. Repetir el mismo lote devuelve el resultado anterior; reutilizar el identificador con otro cuerpo devuelve `409`. Los errores contienen número de fila, campo y código, pero nunca el valor de secretos. Una entrada importada no se hace pasar por compra: no inventa proveedor, costo ni medio de pago.

## Contratos

Crear `contracts/agent-api-v1.json` y `contracts/agent-import-v1.schema.json` antes de las rutas. Deben especificar Bearer token, errores 401/403/409/422, cursores, contexto de sincronización por sucursal y proyecciones permitidas. Las herramientas MCP se documentarán con el mismo nombre de operación y esquema; no habrá endpoint genérico de consulta ni de ejecución SQL.

## Migración y recuperación

Agregar migración aditiva para credenciales, importaciones y resultados idempotentes. Las tablas sensibles son append-only cuando contengan auditoría o resultados ya confirmados. Rotar/revocar una credencial no altera operaciones históricas. Una caída antes del commit no produce productos ni movimientos; una caída después retorna el mismo resultado al reintentar.

## Pruebas y operación

Probar dominio de autorización, integración contra PostgreSQL y contrato HTTP/MCP: agente limitado a Centro, lectura sin costos, revocación, token inválido, cursor, sucursal sin sincronización, unidad inválida en vista previa, confirmación atómica, reintento y conflicto de lote. Registrar actor, operación, sucursal y resultado resumido en auditoría sin registrar tokens. Medir tamaño/duración de lotes antes de establecer límites de producción conforme DEC-012.

## Riesgos abiertos

La política de credenciales operativas, hosting, retención y volumen dependen de DEC-012. Las credenciales de servicios externos no se crean ni se almacenan. Los costos/márgenes permanecen bloqueados por DEC-005; la API no debe abrir una vía alternativa para consultarlos.
