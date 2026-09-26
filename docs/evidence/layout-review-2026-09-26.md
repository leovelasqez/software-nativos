# Revisión de distribución en Administración y Caja — 26-09-2026

Continuación de la corrección de Productos (`14a6c2a`), solicitada por el usuario para las demás pantallas. Trazabilidad: REQ-017-03/04/05, AC-017-01/04/05, TASK-017-08.

## Hallazgos y correcciones

- Inventario: los botones con nombres completos comprimían el nombre del artículo. Separar información, cantidades y acciones; botones visibles concisos con el nombre accesible conservado. Cantidades alineadas en una columna estable, incluidos seis decimales; distribución vertical en móvil.
- Recetas, productos archivados, compras, traslados y conteos: nombres largos con espacio propio, importes y acciones independientes y formularios sin columnas de ancho intrínseco excesivo.
- Clientes y Fidelización: acciones breves, manteniendo etiquetas accesibles específicas; botones debajo del contenido cuando el ancho no permite columnas.
- Usuarios, Sucursales y Auditoría: columnas que admiten nombres largos, estado de usuario visible en móvil y recursos/fechas que pueden pasar a otra línea.
- Resumen e Informes: indicadores con ancho mínimo útil; etiquetas y totales de Informes en líneas separadas. Columnas numéricas alineadas, sin partir importes en las tablas. El texto de las celdas respeta palabras completas: identificadores largos no reducen «Tipo», «Venta» o «Cliente» a fragmentos de letras.
- Informes, Notificaciones y Respaldos: desplazamiento horizontal dentro de la tabla, con región accesible por teclado y foco visible.
- Caja: precio y botón de agregar ocupan espacio real en la tarjeta; nombre e importe del pedido separados; total móvil sobre los botones; resumen de cobro adaptable. Las reglas nuevas de Caja se limitan a pantalla.

## Revisión visual y de interacción

Inspección inicial de solo lectura en el servicio publicado: Inventario reproducía la compresión de nombres e Informes dividía cantidades entre líneas. La revisión de cambios se realizó en una vista local de los componentes administrativos reales con respuestas sintéticas: nombres extensos, cadenas sin espacios, importes grandes, cantidades con seis decimales, múltiples acciones y tablas anchas.

| Comprobación | Resultado observado |
| --- | --- |
| 15 módulos administrativos a 390 px, tema oscuro | Sin desbordamiento horizontal de la página ni alertas de carga con los datos de revisión. |
| 15 módulos administrativos a 1440 px, tema oscuro | Sin desbordamiento ni recorte detectado de encabezados y botones. |
| 320 px, tema claro | Recorrido de módulos y Resumen; tablas conservan desplazamiento interno. |
| 686 px, tema claro | Inventario, Compras, Clientes, Fidelización, Usuarios y Resumen comprobados; nombres y acciones separados. |
| Inventario a 686 px | `1.234.567,123456 g` cabe en una línea en la columna de cantidad. |
| Informes a 320 px | Total `$ 1.253.067,89` completo en una línea de 30,8 px de alto; etiqueta arriba. Página de 320 px, tabla de 640 px dentro de región de 286 px. |
| Teclado en Informes | Flecha derecha desplaza 40 px la región enfocada; foco visible y sin ensanchar la página. |
| Texto de tablas a 611 px | «Tipo», «Venta» y «Cliente» ocupan una línea. Revalidado sin desbordamiento de página a 320 y 1440 px, incluido oscuro. |
| Formulario de receta a 390 px, oscuro | Nombre largo legible, sin desbordamiento del diálogo, foco inicial, Tab y Escape operativos. |
| Caja/cobro a 320/390 px y escritorio | Nombre largo, precio y botón separados; total y controles legibles en claro/oscuro. |

Se inspeccionaron capturas además de mediciones DOM. La vista local de Caja reproduce el marcado de sus tarjetas/pedido y monta los componentes reales de cobro y pestañas; no sustituye la prueba E2E de Caja completa. Las respuestas sintéticas no admiten escrituras comerciales. La regresión del navegador utiliza su propia base aislada.

## Verificación automatizada y publicación

- `npm run check`: aprobado; contratos/tipos, 56 pruebas unitarias, 66 pruebas de integración y compilación.
- La regresión detectó diferencias en los nombres accesibles de Gestionar traslado y las acciones de Fidelización; se conservaron los originales junto a los textos visibles concisos. También se corrigió una carrera previa del test al volver de Caja: ahora espera el selector de sucursal antes de consultar y abrir el menú móvil, sin eliminar ninguna comprobación.
- `npm run test:e2e`: aprobado sobre la compilación final, incluido el ajuste de palabras de las tablas; 1 prueba compuesta, 4 minutos, con Administración, Caja, exportación, fidelización y recuperación/sincronización offline. Incluye comprobaciones de teclado, accesibilidad y capturas.
- `git diff --check`: aprobado. Publicación pendiente de confirmación del servicio y sus assets.

## Límites

No se alteran contratos, cálculos, permisos, inventario real ni almacenamiento offline. No se realizaron cobros, traslados, envíos ni cambios comerciales en producción. La revisión visual cubre los tamaños y datos descritos; no equivale a probar todas las combinaciones posibles ni una certificación exhaustiva de accesibilidad. No se repitieron pruebas físicas de impresora/cajón.
