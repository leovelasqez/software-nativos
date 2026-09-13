# 010 — API y MCP para agentes de IA

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, sección 13.

## Requisitos

- REQ-010-01: identidades/credenciales revocables por agente y permisos por sucursal, incluidos límites de consulta de costos.
- REQ-010-02: API documentada y servidor MCP sobre la misma lógica; consultar productos/recetas/existencias/movimientos y ventas/reportes.
- REQ-010-03: cargar inventario masivamente distinguiendo saldo inicial, entrada y ajuste; crear productos con presentaciones y recetas; vista previa, validación por fila e idempotencia.
- REQ-010-04: auditar actor y operación, proteger secretos y exponer actualidad de datos; no conceder acceso directo irrestricto a la base.

## Fronteras

Diseñar contrato de autenticación, permisos, consulta paginada, trabajo de importación, reporte de errores y recuperación. Las herramientas MCP se derivan de operaciones de dominio estables; no crear un mecanismo de SQL arbitrario para el agente.

## Aceptación

- AC-010-01 → REQ-010-01/02. Dado un agente de consultas limitado a Centro, cuando intenta crear productos o acceder a Milán, entonces API y MCP rechazan la acción coherentemente.
- AC-010-02 → REQ-010-03. Dada una carga con unidad inválida, cuando se valida, entonces se identifica la fila y no se aplica silenciosamente un movimiento incorrecto; la política de aplicación parcial se define antes del contrato definitivo.
- AC-010-03 → REQ-010-03. Dada una carga/producto ya confirmado, cuando se repite con el mismo identificador de operación, entonces se devuelve su resultado sin duplicar existencias o producto.
- AC-010-04 → REQ-010-02/04. Dada una consulta con local sin sincronizar, cuando el agente solicita reporte, entonces recibe contexto de actualización y solo campos autorizados, sin secretos en registros.

## Dependencias y pendientes

001/002/003/007/008. Contratos definitivos cuando estas capacidades estén refinadas. Configurar identidad de agentes no autoriza por sí solo a ejecutar operaciones externas. Evidencia: pendiente.
