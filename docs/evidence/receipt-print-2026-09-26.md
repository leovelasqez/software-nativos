# Corrección de impresión térmica — AC-017-06

Solicitud: evitar las 31 hojas de vista previa reportadas al imprimir un comprobante en POS de 80 mm. Autorización de publicación: «continua», después de informar que el cambio estaba probado localmente y pendiente de publicar.

## Cambio

`web/Pos.tsx` identifica el diálogo e imprime opciones/notas solo cuando existen. `web/pos.css` elimina catálogo, navegación y controles del flujo de impresión; restablece las alturas, el posicionamiento y el desbordamiento del diálogo y sus contenedores. Recibo de 72 mm como máximo, con tipografía y espacios compactos, usando el papel seleccionado en el controlador. No cambia cálculos ni registros comerciales.

## Verificación local

- `npm run typecheck`, `npm run build` y `git diff --check`: correctos.
- Fixture construido a partir del JSX real del comprobante en `Pos.tsx`, con los componentes `Dialog`, `Logo` y `Notice` reales y la cascada CSS del proyecto. Datos sintéticos y catálogo de 300 productos detrás del diálogo.
- Playwright CLI con Microsoft Edge; generación de PDF a 72,1 × 210 mm sin encabezados/pies del navegador. Extracción con pypdf y revisión visual de la página renderizada con pypdfium2.

| Caso | Resultado |
| --- | --- |
| 3 productos, escritorio claro | 1 página |
| 5 productos, escritorio oscuro, impuestos y puntos | 1 página |
| 3 productos, móvil de 390 px, oscuro | 1 página |
| 30 productos, escritorio claro | 3 páginas, sin recortar productos ni totales |

Todos los PDF conservan productos, total, pagos y cambio. No incluyen catálogo, navegación, botón de impresión ni aviso de copia. El botón vuelve a estar visible al regresar a pantalla. Artefactos locales en `output/playwright/receipt-*.pdf`, `receipt-paper.png`, `create-receipt-fixture.mjs`, `verify-receipt-print.js` y `verify-pdf.py` (directorio excluido de Git).

Límites: no se imprimió físicamente ni se modificaron ventas para probar. Firefox no pudo ejecutarse con el runtime disponible (versión de navegador incompatible con el protocolo de Playwright); no se presenta como validado. Los recibos que exceden físicamente 210 mm necesitan más páginas para conservar legibilidad y contenido.

## Publicación

Commit `7973c98`, enviado a `origin/main`. Publicado desde un archivo Git de ese commit en Railway, servicio `nativos-web`, entorno `production`. Despliegue `d2e6e4bf-fa97-420a-bdf2-9ba6a8273417`: `SUCCESS`.

Verificación del 26-09-2026 a las 15:22:29 UTC: `/health` devuelve HTTP 200 y `{"ok":true}`; `/caja` devuelve HTTP 200 y la entrada `pos-C_p85j13.js`. Los seis assets publicados y `sw.js` coinciden por SHA-256 con la compilación probada. [Manifiesto de verificación](receipt-print-2026-09-26-deployment.json). Las consultas productivas fueron de solo lectura y no operaron turnos ni registraron ventas.
