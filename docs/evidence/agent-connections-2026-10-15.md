# Conexiones MCP de consulta — 15-10-2026

Solicitud: conectar Nativos a Codex o Claude empezando por consultas de solo lectura. Implementación local de REQ-010-05/06 y AC-010-05/06/07, siguiendo especificación, plan, contrato y tareas de 010. No se ha publicado este incremento ni creado credenciales comerciales.

## Resultado

- `src/server/agent-mcp.ts` usa `@modelcontextprotocol/sdk` 1.32.1, Streamable HTTP stateless y respuestas JSON. El adaptador web-standard conserva el ciclo de respuesta y las cabeceras de Fastify. El SDK maneja inicialización y notificaciones; se validan argumentos con AJV y se delega a las rutas de dominio, que vuelven a autenticar/autorizar cada consulta.
- `/api/agent/v1/mcp/read-only` expone sólo seis consultas, incluso para tokens con permisos más amplios. El MCP histórico conserva importaciones según sus permisos. Se mantienen Host/Origin y el CSRF de las demás rutas; GET/DELETE de MCP se autentican y devuelven 405 sin cambios.
- Contexto de sucursales/bodegas autorizadas y última sincronización; filtros y paginación de informes publicados en las herramientas. La zona de fechas es America/Bogota. Se rechazan campos desconocidos, límites fuera de rango y filtros incompatibles.
- Pantalla de dueño **Agentes de IA** con creación de consulta (`data.read` fijado en servidor), selección de sucursales, listado sin secretos, renovación y revocación con motivo. El token nuevo permanece sólo en estado efímero de React hasta cerrar el diálogo. Listado y auditoría no incluyen tokens ni hashes.
- Guía de conexión en `docs/operations/agent-connections.md`, contrastada con documentación oficial de OpenAI, Claude Code y MCP. La pantalla incluye ejemplos sin credenciales reales. No se implementa OAuth para conectores Claude web/Desktop.
- Revisión de accesibilidad: la navegación móvil compartida se marca como `nav`, resolviendo el hallazgo de landmark de axe. Sin cambios de comportamiento de Caja.

## Verificaciones completadas

| Verificación | Resultado |
| --- | --- |
| `npm.cmd run typecheck` | Correcto, sin desactivar strict ni exactOptionalPropertyTypes |
| `npm.cmd test` | 75 aprobadas, 0 fallos |
| `node --test --test-reporter=tap tests/integration/agent-api.test.ts` | Correcto; preserva consultas e importaciones del incremento 7A |
| `node --test --test-reporter=tap tests/integration/agent-mcp.test.ts` | 6 aprobadas, 0 fallos; cliente SDK oficial sobre socket HTTP real y PostgreSQL sintético |
| `npm.cmd run test:integration` | 84 aprobadas, 0 fallos, 0 omitidas; 833,094 s, ejecución serial |
| `node node_modules/@playwright/test/cli.js test --config playwright.agents.config.ts` | 1 aprobada en Edge; 44,1 s de escenario, sin errores de página |
| axe, móvil 390 px y escritorio 1440 px, claro/oscuro | Sin infracciones en las cuatro combinaciones; sin desbordamiento horizontal del documento |
| `npm.cmd run build` | Correcto; Administración/Caja/service worker compilados |
| `git diff --check` | Correcto; Git sólo informa conversión habitual LF/CRLF |
| Instalación de SDK con npm | 0 vulnerabilidades reportadas por npm al instalar |

Regresión general completada: incluye agentes, respaldo, permisos de usuarios, Caja, catálogo/inventario, auditoría, dashboard, Excel, fidelización, pedidos, sincronización, informes y vendedores. Los hashes de las fuentes de esta conexión se conservan en `agent-connections-2026-10-15/source-hashes.json` y se comprobaron tras las verificaciones.

## Escenarios comprobados

El cliente oficial negocia el protocolo, envía la notificación de inicialización, descubre herramientas y consulta contexto, catálogo, recetas, inventario, movimientos e informes con filtros. Se comprueban paginación de inventario, fechas de Colombia, `branchId:all` limitado al alcance, denegación de otra sucursal, compras sin `purchase.read`, escrituras y argumentos arbitrarios. La credencial amplia tampoco permite escribir desde el endpoint de consulta. No se modifican los movimientos comerciales durante estas consultas.

La cookie del dueño no autentica MCP; Bearer es obligatorio en cada petición. Origen y Host ajenos se rechazan. La API web sigue rechazando cambios sin cabecera CSRF. Un cajero no ve ni administra agentes; el dueño limitado a otra sucursal no lista ni rota agentes fuera de su alcance. Renovar invalida al cliente ya conectado con token anterior; revocar invalida las siguientes peticiones del cliente renovado.

El E2E crea y revoca una credencial sintética, comprueba que no aparece en localStorage/sessionStorage, ejercita teclado/Escape, ambos temas y móvil. Las capturas se toman con el diálogo de secreto cerrado. El test usa servidor/base propios en puerto libre; `playwright.agents.config.ts` permite ejecutarlo sin depender del servidor compartido de E2E.

El cliente HTTP oficial del SDK presenta una incompatibilidad en su declaración de `sessionId` con `exactOptionalPropertyTypes` de TypeScript. Sólo en el test se carga su runtime mediante `createRequire` con el contrato mínimo de transporte. No se modifica node_modules ni se debilitan las opciones del proyecto. El servidor usa la variante web-standard, compatible con las opciones estrictas.

## Revisión visual

Capturas revisadas: [escritorio claro](agent-connections-2026-10-15/1440-light.png), [escritorio oscuro](agent-connections-2026-10-15/1440-dark.png), [móvil claro](agent-connections-2026-10-15/390-light.png) y [móvil oscuro](agent-connections-2026-10-15/390-dark.png). Contienen nombres, operaciones y dirección local de prueba.

## Límites de la evidencia

No acredita una sesión real de Codex ni Claude Code consultando la base publicada. Quedan publicación, emisión privada de una credencial por el dueño y configuración del cliente elegido. No se registran nuevas ventas, ajustes de inventario ni cambios en Alegra. Compras requiere un permiso adicional que no se concede en esta pantalla; costos/márgenes, descarga MCP de Excel e importaciones desde la conexión de consulta quedan fuera de este incremento.

El árbol de trabajo ya contenía cambios ajenos de acceso/recuperación de Caja y archivos Excel no versionados. Se conservaron. No se hizo commit, push ni despliegue en este turno.
