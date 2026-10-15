# Publicación de conexiones MCP — 15-10-2026

El usuario autoriza publicar la conexión de consulta: «Si, publicala». Commit funcional `a2d05a5`, enviado a `origin/main`. Se preparó un archivo Git desde ese commit y se publicó en el proyecto existente `nativos`, servicio `nativos-web`, entorno `production`. Los cambios ajenos pendientes de Caja y los Excel comerciales no versionados se conservaron y quedaron fuera del paquete.

## Verificación del paquete exacto

Antes de subir, se extrajo el commit en `.local/release-agents-a2d05a5` y se ejecutaron `npm run typecheck`, `npm run build` y `node --test --test-reporter=tap tests/integration/agent-mcp.test.ts`: todo correcto, 6 casos de cliente MCP oficial aprobados. Esta comprobación evita depender de los cambios ajenos presentes en el árbol de trabajo. El empaquetado utiliza `.railwayignore`, que excluye datos locales, credenciales, pruebas, documentos y hojas de cálculo.

## Publicación comprobada

- Despliegue Railway `cc416762-8a90-4e6e-8af1-e060b869a99f`: `SUCCESS`.
- Sitio: https://nativos-web-production.up.railway.app.
- `/health`: HTTP 200, `ok=true`. `/api/status`: `setupRequired=false`.
- Los 13 recursos de Administración/Caja, scripts, estilos, fuente e identidad coinciden con la compilación del commit. Se normalizan CRLF/LF al comparar el archivo estático `theme.js`.
- Ocho comprobaciones de frontera: listado de agentes, contexto, inventario e informes requieren autenticación (401); ambos endpoints MCP rechazan POST sin Bearer con 401, sin exigir la cabecera CSRF web; ambos rechazan origen ajeno con 403.
- La instalación en Railway informó cero vulnerabilidades conocidas; compilación y healthcheck correctos.
- Evidencia de rutas y hashes: [deployment.json](agent-connections-2026-10-15/deployment.json).

La sesión del dueño confirmó la aparición del módulo **Agentes de IA** en la versión publicada. No se modificaron ventas, turnos, inventario, vendedores ni Alegra.

## Conexión local de Codex

El dueño inició sesión y creó **Codex consultas**, con `data.read` para Centro y Milán. Se registró el servidor `nativos` en la configuración local de Codex, apuntando a `/api/agent/v1/mcp/read-only`. El token se exportó mediante el botón de copia de Nativos y se trasladó cifrado a este equipo; no se mostró en el chat, los argumentos de proceso ni el repositorio. Se guarda con Windows DPAPI CurrentUser fuera del proyecto, y Codex lo obtiene mediante un `http_headers_helper` privado. No se requiere una variable de entorno con el token en esta instalación. La clave temporal de traslado fue eliminada y se restauró el portapapeles del navegador.

Se verificó autenticación real y cinco consultas autorizadas por HTTP: productos, recetas, inventario, movimientos e informe de ventas con fechas de Colombia; el contexto confirma Centro y Milán. El listado expone sólo seis herramientas de consulta, sin importaciones. [Resultado sin secretos](agent-connections-2026-10-15/live-connection.json).

También se comprobó el cliente real de **Codex CLI 0.154.0** mediante `app-server`: inicialización y `mcpServerStatus/list` cargan las seis herramientas de `nativos` desde la configuración instalada y su helper. Esta verificación no creó un chat ni invocó un modelo; los demás MCP y plugins estuvieron desactivados sólo en el proceso de diagnóstico. [Resultado](agent-connections-2026-10-15/codex-connection.json).

Para cargar las herramientas en la interfaz de Codex se abre una conversación nueva; si una sesión existente conserva el catálogo anterior, se reinicia esa conexión o la app. Claude Code conserva su guía, pero no se configuró en esta entrega. La creación de la credencial fue el único cambio de configuración del negocio: no se registraron ventas ni movimientos comerciales para probarla.
