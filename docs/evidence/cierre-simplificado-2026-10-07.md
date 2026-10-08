# Comprobante de cierre simplificado — 07-10-2026

Solicitud: usar la estructura simplificada de la foto aportada, manteniendo el mismo comprobante y su revisión antes del cierre. La foto se usa como referencia de presentación; sus importes y número no se incorporan al libro.

## Cambio y comprobaciones

- AC-006-12: resumen de dos columnas con separadores punteados. Incluye identificación real del turno, sucursal/responsable, fechas, total de ventas, base inicial, ventas por efectivo/tarjeta/transferencia/Bre-B/Daviplata/Nequi, devoluciones y retiros de efectivo. Ingresos, gastos, retiros digitales y correcciones aparecen cuando existen. El resumen muestra total de movimientos con base, dinero en efectivo del cierre, esperado y diferencia; en revisión usa esperado y conserva los campos de cierre pendientes.
- AC-006-13: «Ver detalle completo» conserva las secciones originales y el detalle cronológico en pantalla. Está cerrado inicialmente; incluso abierto queda fuera de la impresión compacta. Los botones y avisos de ayuda de pantalla tampoco se imprimen. Se ofrece espacio de observaciones para completar en papel.
- Tarjeta se conserva agrupada porque el medio registrado no distingue débito y crédito. El identificador del turno no se sustituye por una numeración correlativa inventada.
- La prueba sintética con base $50.000, ventas $28.000 y gasto $1.000 comprueba total de movimientos $77.000; contado $77.500 y diferencia $500. Total de movimientos del resumen = base + neto de todos los medios, calculado con decimales exactos. No modifica el neto guardado ni suma propinas/domicilios nuevamente.
- Se conserva el E2E de turno compartido, revisión offline, invariancia del agregado cifrado, recarga, reimpresión e igualdad de totales revisión/cierre.

## Validación

- `npm.cmd run typecheck`: correcto.
- `npm.cmd run build`: correcto.
- `npm.cmd run test:e2e`: 1 escenario integral correcto (4,0 minutos), con PostgreSQL sintético y Edge/IndexedDB/service worker reales.
- E2E comprueba apertura/cierre del detalle, valores del resumen, espacio de observaciones, CSS de impresión de 72 mm y altura compacta inferior a 900 px. Confirma que el detalle abierto permanece invisible en papel. Revisa móvil/escritorio, claro/oscuro, teclado y axe sin infracciones.
- `git diff --check`: correcto. El dominio, servidor, persistencia y contratos de eventos no cambian; las verificaciones monetarias y de libro existentes se conservan.

Capturas revisadas en [cierre-simplificado-2026-10-07/](cierre-simplificado-2026-10-07/): `simple-close-print.png`, `simple-review-print.png`, `close-desktop-light.png`, `close-desktop-dark.png`, `review-mobile-light.png` y `review-mobile-dark.png`.

## Publicación y límites

Publicado como continuación del mismo comprobante autorizado en Railway, servicio `nativos-web`, entorno `production`. Commit funcional `b35e65a7dac520c732013cb7a8d14b6676ac2375`, enviado a `origin/main`; se publicó un archivo Git de ese commit, excluyendo los archivos comerciales no versionados. Despliegue `6a4ec6d4-e943-4e9e-be5e-18dc23fff123`: `SUCCESS`, con healthcheck aprobado.

Verificación del 07-10-2026 a las 8:58 p. m. de Colombia (2026-10-08T01:58:01Z): `/health` responde HTTP 200 y `{"ok":true}`; `/` y `/caja` responden HTTP 200. Los doce archivos públicos comprobados corresponden a la compilación validada: HTML, todos los assets JS/CSS/fuente, service worker, manifiesto e icono. `theme.js` coincide tras normalizar únicamente CRLF/LF. Hashes y resultados en [deployment.json](cierre-simplificado-2026-10-07/deployment.json).

Las pruebas funcionales usan datos sintéticos; la comprobación productiva solo consulta salud y archivos públicos, sin operar turnos comerciales. La impresión física debe comprobarse con las impresoras de los locales. Observaciones es un espacio en papel, no un nuevo campo persistido.
