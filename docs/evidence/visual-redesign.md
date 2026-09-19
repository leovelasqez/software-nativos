# Evidencia 017 — Identidad visual y Resumen operativo

19-09-2026. Propuesta aprobada en esta tarea; implementación local en el sitio real de React/PostgreSQL. Todos los datos usados para verificarla son sintéticos. No se desplegó ni se alteraron datos del negocio, Alegra o hardware.

## Trazabilidad

| Aceptación | Implementación | Evidencia |
| --- | --- | --- |
| AC-017-01 | theme.css, design.css, font.css, Icon, componentes, navegación y acceso comunes; Informes legibles | 15 módulos × 3 anchos (1366/390/320) × 2 temas = 90 comprobaciones: sin desbordamiento de página, carbón exacto, Inter cargada, sin pageerror. 60 auditorías axe WCAG 2 A/AA y 2.1 AA (15 × 2 anchos × 2 temas), cero infracciones detectadas. Cuatro revisiones adicionales de formulario: contraste, Tab, Escape y retorno del foco. |
| AC-017-02 | dashboard.ts, dashboard-api.ts | Cuatro pruebas de dominio y una integración PostgreSQL con 120 ventas más casos de límites. Decimales exactos, límites día/mes Colombia, devolución de venta del mes anterior, exclusión de propina/envío/canje según importes históricos, ranking de cinco, cantidades fraccionarias, legado, mínimo igual a cero/igual al saldo, combinación de sucursales, data.read y rechazo de filtros ajenos. Sin datos de cliente/costos en respuesta. |
| AC-017-03 | Dashboard, selector y navegación a Inventory | 17 verificaciones CLI sobre venta confirmada: $64.000 cobrados, $63.000 de productos y $1.000 de propina; Resumen y ticket muestran $63.000. Milán vacío, Centro con datos, top cinco, alertas, carga, error 503 simulado sin ceros falsos, recarga, respuesta tardía de otra sucursal descartada y apertura de bodega no predeterminada desde alerta. Seis variantes de Resumen poblado sin desbordamiento. |
| AC-017-04 | Pos, estilos compartidos sobre mecánicas de 016, fuentes precargadas | Recorrido real sintético con seis líneas y 18 productos, 1366×768 y 1024×768 en ambos temas: precios dentro de tarjetas y cobro completo en viewport. Diálogo de cobro con pie visible en escritorio/móvil. Recarga de Caja desconectada, Inter cargada desde caché y sin recursos externos. Comprobante impreso negro sobre blanco aun con tema oscuro. Suite existente cubre además listas de 30 productos/12 líneas y flujos críticos. |
| AC-017-05 | Pruebas y compilación del repositorio | 45 pruebas unitarias y 58 de integración aprobadas; typecheck y build aprobados. Regresión E2E final completa aprobada: 1 prueba compuesta, 2,3 minutos, sobre los estilos finales. |

## Revisión visual

Se revisaron capturas de los 15 módulos administrativos: Resumen, Sucursales y bodegas, Productos, Recetas, Inventario, Compras y proveedores, Traslados, Conteos y ajustes, Clientes, Fidelización, Informes, Usuarios y roles, Auditoría, Notificaciones y Respaldo y recuperación. Se revisaron además acceso, formularios, Caja, cobro y presentación de impresión.

Hallazgos corregidos antes de entregar:

- Orden de cascada compartida en la compilación de ambos puntos de entrada.
- Tarjetas de Caja con alto intrínseco suficiente para textos de dos líneas y precio sin desbordamiento.
- Espaciado en Conteos/Respaldo/Fidelización y menú con marca/cuenta siempre visibles en escritorio.
- Alertas que abren la bodega correspondiente, no siempre la predeterminada.
- Detalle de Informes estructurado, sin una tabla principal de decenas de columnas o JSON sin presentar.

Capturas conservadas; los importes y existencias negativos que aparecen pertenecen exclusivamente a las pruebas:

- [Resumen claro](visual-redesign/resumen-claro.png), [oscuro](visual-redesign/resumen-oscuro.png) y [móvil](visual-redesign/resumen-movil.png).
- [Caja clara](visual-redesign/caja-desktop-light.png), [oscura](visual-redesign/caja-desktop-dark.png), [1024 px](visual-redesign/caja-tablet-light.png).
- [Cobro](visual-redesign/caja-checkout-1366.png), [cobro móvil](visual-redesign/caja-checkout-390.png) y [modo impresión](visual-redesign/impresion.png).
- [Acceso claro](visual-redesign/acceso-claro.png) y [oscuro](visual-redesign/acceso-oscuro.png).
- [Formulario oscuro](visual-redesign/formulario-oscuro.png), [formulario móvil](visual-redesign/formulario-movil.png), [inventario móvil](visual-redesign/inventario-movil.png) e [Informes](visual-redesign/informes.png).

El control final de compatibilidad conserva el archivado de 013: las alertas omiten artículos archivados como Inventario, sin excluir sus ventas históricas. Se añadió esa condición a la prueba específica de integración y se volvió a ejecutar.

## Reproducción

Desde la raíz del repositorio:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:integration
npm.cmd run build
npm.cmd run test:e2e
```

La suite E2E arranca y detiene su propia base PostgreSQL aislada. No ejecutar otra instancia en 4320 al mismo tiempo. Capturas de la suite en test-results/caja-ui y test-results/unified-web. Los scripts complementarios de Playwright CLI están en [qa](visual-redesign/qa/README.md); no son pruebas sobre una base del negocio.

## Límites

- Sin publicación, prueba de impresoras/cajón físicos ni movimientos comerciales reales. El CSS de impresión sí se inspeccionó en modo print.
- Las 60 auditorías automatizadas sin infracciones no equivalen a una certificación exhaustiva de accesibilidad.
- El Resumen incluye solo operaciones recibidas por el servidor y lo advierte. Una caja offline puede tener ventas pendientes; no se ocultan ni se presentan como sincronizadas.
- Móvil prioriza consultas; no se retiraron permisos ni funciones por ancho de pantalla.
- El cambio se construye sobre el trabajo previo de 012/016 presente en el árbol. No se revirtieron esos cambios ni se alteraron las reglas de cobro, recetas, puntos o inventario.
