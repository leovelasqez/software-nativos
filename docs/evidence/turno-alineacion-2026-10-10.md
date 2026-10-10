# Alineación de Turno de caja — 10-10-2026

REQ-006-07 / AC-006-14. El usuario solicita corregir la alineación de los textos de la pantalla mostrada, hacer commit y publicar en Railway.

La regla general `.panel>h2` agregaba 24 px de sangría al responsable dentro de una tarjeta que ya tiene su propio padding. `web/pos-layout-fixes.css` elimina ese segundo padding y los márgenes adicionales de avisos y botones directos. La identidad del menú lateral ocupa una fila completa; Salir pasa a la siguiente para evitar partir el apellido por falta de espacio.

Verificación de la aplicación real con PostgreSQL e IndexedDB sintéticos aislados, en Chrome 154 mediante `agent-browser`:

- `npm run typecheck` y `npm run build`: aprobados.
- Turno abierto y cerrado: 1042×566, 1440×900 y 390×844, cada tamaño en claro y oscuro (12 combinaciones). Textos, títulos y acciones alineados; sin desbordamiento horizontal.
- Menú lateral visible: identidad y salida en filas independientes en los seis casos de turno abierto.
- Tab entre acciones con foco visible; formularios de movimientos y cierre se abren y se cierran con Escape. Apertura y cierre de prueba con base/conteo sintéticos de $500.000.
- Capturas revisadas: [escritorio](turno-alineacion-2026-10-10/escritorio-claro.png), [móvil oscuro](turno-alineacion-2026-10-10/movil-oscuro.png). [Mediciones del navegador](turno-alineacion-2026-10-10/verification.json).

El cambio es exclusivamente de estilos de pantalla.

## Publicación verificada

Commit funcional `f4b1778` enviado a `origin/main`. Publicado en Railway, proyecto `nativos`, servicio `nativos-web`, entorno `production`, despliegue `48ea442c-a1ad-46b1-9c93-8ab7774655a8`, estado `SUCCESS`.

<https://nativos-web-production.up.railway.app/caja>. `/health`: HTTP 200, `{"ok":true}`; `/api/status`: instalación configurada. Las doce rutas del build y las entradas `/` y `/caja` responden HTTP 200 y coinciden con la compilación verificada. `/theme.js` se compara normalizando CRLF/LF; el resto coincide byte a byte. [Resultados y hashes](turno-alineacion-2026-10-10/deployment.json).

Paquete de 163 archivos preparado con `git archive` desde el commit, exclusivamente fuentes y configuración necesarias para la aplicación. La verificación de producción fue de solo lectura, sin operar turnos comerciales. Navegador y base sintética de comprobación detenidos al finalizar.
