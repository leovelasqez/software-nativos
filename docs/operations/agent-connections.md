# Conectar consultas de Nativos a Codex y Claude Code

Alcance del incremento del 15-10-2026: consultas online de catálogo compartido, recetas activas, existencias/movimientos e informes de sucursales autorizadas. La pantalla de dueño crea credenciales con `data.read`; compras requiere el permiso adicional `purchase.read` y no se concede desde esta pantalla. Costos y márgenes no se incorporan a esta conexión. No se requiere una clave de API de OpenAI o Anthropic para que Nativos atienda MCP: el asistente usa su propia sesión.

## 1. Crear la conexión

Una vez publicada esta versión, entrar como dueño en Nativos → **Agentes de IA** → **Nueva conexión**. Dar un nombre por asistente (por ejemplo, Codex consultas), seleccionar sucursales e indicar el motivo. La credencial nueva se muestra una sola vez. Guardarla por un canal privado; no incluirla en documentos, capturas, chats, repositorios ni argumentos visibles de comandos. Se puede renovar o revocar desde esa misma pantalla.

El endpoint de consulta es el origen del sitio seguido de `/api/agent/v1/mcp/read-only`. En Railway: `https://nativos-web-production.up.railway.app/api/agent/v1/mcp/read-only`. En desarrollo sustituir el origen por el que esté atendiendo la base deseada. Una base sintética de pruebas no contiene datos comerciales.

## 2. Variable privada en Windows

En PowerShell, pedir la credencial con entrada oculta antes de iniciar el cliente desde esa terminal:

```powershell
$nativosSecret = Read-Host 'Credencial de Nativos' -AsSecureString
$env:NATIVOS_AGENT_TOKEN = [System.Net.NetworkCredential]::new('', $nativosSecret).Password
```

La variable dura esa sesión/procesos hijos y no imprime ni guarda la credencial en el historial. Para la app de Codex, su proceso debe heredar la variable: cerrarla completamente y abrirla desde el entorno configurado, o suministrar el Bearer mediante la configuración privada de MCP admitida por esa instalación. No escribir el token real en `config.toml` ni `.mcp.json`. No usar una variable de credenciales de OpenAI/Anthropic como token de Nativos.

## 3. Codex

Combinar con la configuración MCP existente en `~/.codex/config.toml` o la configuración del proyecto; no reemplazar el archivo completo:

```toml
[mcp_servers.nativos]
url = "https://nativos-web-production.up.railway.app/api/agent/v1/mcp/read-only"
bearer_token_env_var = "NATIVOS_AGENT_TOKEN"
```

Abrir una sesión nueva y comprobar el servidor en la lista de MCP. El chat actual puede conservar su catálogo de herramientas anterior hasta abrir una sesión nueva. La disponibilidad desde ChatGPT web y otros entornos requiere su propia configuración y no se acredita con un archivo local de Codex.

Fuente: [documentación oficial de OpenAI sobre MCP](https://developers.openai.com/codex/mcp), consultada el 15-10-2026.

## 4. Claude Code

Combinar esta entrada en `.mcp.json` del proyecto. No contiene el token real:

```json
{
  "mcpServers": {
    "nativos": {
      "type": "http",
      "url": "https://nativos-web-production.up.railway.app/api/agent/v1/mcp/read-only",
      "headers": { "Authorization": "Bearer ${NATIVOS_AGENT_TOKEN}" }
    }
  }
}
```

Iniciar Claude Code desde el entorno con la variable y verificar con `/mcp`. Esta guía es para Claude Code. No se ha implementado OAuth ni se acredita compatibilidad con los conectores de Claude web o la configuración de Claude Desktop. Cada cliente debe comprobarse por separado.

Fuente: [documentación oficial de Claude Code sobre MCP](https://code.claude.com/docs/en/mcp), consultada el 15-10-2026; admite HTTP, cabecera Authorization y expansión de variables en `headers`.

## 5. Consultas de aceptación

1. «Muéstrame mis sucursales y bodegas autorizadas y la última sincronización». Usa `nativos_context_get`.
2. «Consulta existencias y mínimos de Centro; recorre todas las páginas».
3. «Consulta ventas de Centro entre el 1 y el 14 de octubre de 2026». Las fechas son inclusivas y de Colombia. El agente debe pasar `from` y `to` a `nativos_report_get`.
4. «Compara las ventas de mis sucursales». `branchId:all` sólo abarca las asignadas al agente.

El agente debe recorrer `nextCursor` para completar detalles y no volver a sumar los totales globales por cada página. `lastSynchronizedAt:null` significa sin sincronización registrada. Una fecha de sincronización no acredita que todos los equipos estén al día; no afirmar que incluye ventas que sigan offline.

## 6. Renovación, revocación y diagnóstico

Renovar invalida inmediatamente el token anterior. Actualizar la variable privada y reiniciar la conexión del asistente. Revocar invalida las siguientes peticiones, incluso para clientes ya inicializados. Los registros comerciales e importaciones anteriores se conservan.

- 401: credencial ausente, antigua, inválida o revocada. La cookie del dueño no autentica MCP.
- 403: sucursal/acción no autorizada u origen/Host ajeno. No quitar las comprobaciones de origen para corregirlo.
- 404: comprobar la publicación y el endpoint exacto.
- 405 en GET/DELETE: esperado para este servidor stateless; el transporte usa POST y no requiere un canal SSE continuo.
- `invalid_arguments`/`invalid_filter`: revisar herramienta, filtros compatibles, fechas y paginación. SQL y herramientas arbitrarias no están disponibles.

La conexión usa Streamable HTTP stateless con respuesta JSON del [SDK oficial MCP](https://ts.sdk.modelcontextprotocol.io/server). No se necesita `X-Nativos-Request` en MCP; esa protección sigue siendo obligatoria para cambios desde la web y rutas REST de importación. El endpoint de consulta sólo expone seis herramientas de lectura; el endpoint histórico mantiene las importaciones según permisos.
