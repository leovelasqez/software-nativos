# Corrección y nueva validación de flujos — 25-09-2026

Los tres defectos NAT-UAT-01/02/03 del [informe inicial](validacion-navegador-2026-09-25.md) están corregidos y verificados en la versión local. La batería ampliada de navegador terminó con **18 aprobados y 0 fallidos**. Este resultado cierra esos defectos dentro del alcance probado; no declara que todas las variantes del plan de lanzamiento estén acreditadas.

## Versión y entorno

- Base Git: `601ef7010fef6b9b7fb74f90194d160133d6ff97`, más los cambios de este trabajo. Las huellas de los archivos modificados están en [version-verificada.json](correccion-flujos-2026-09-25/version-verificada.json).
- Edge real automatizado con Playwright, aplicación compilada y PostgreSQL local nuevo. Caja utiliza IndexedDB y su sincronización real. No se usó una maqueta ni se sustituyeron respuestas del servidor para aprobar estos casos.
- Cuentas, catálogo, recetas y existencias iniciales sintéticas. Las API y algunas inserciones de volumen preparan las precondiciones; los recorridos, formularios, filtros, descargas y restauración se ejecutan desde el navegador. Los saldos se contrastan con el servidor/base aislada.
- Ejecución final de los 18 casos: `2026-09-25T15-04-50-429Z`. [Resultados completos](correccion-flujos-2026-09-25/results.json).
- No se desplegaron estos cambios en Railway ni se hicieron transacciones de prueba sobre los datos reales. La autorización de implementación local y sus límites se mantienen en [agents.md](../../agents.md).

## Defectos cerrados

| Defecto | Corrección | Resultado observado |
| --- | --- | --- |
| NAT-UAT-01: la restauración fallaba con movimientos de ventas | Captura transaccional consistente; movimientos después de sus referencias; inclusión de conciliaciones de costos; sustitución de semillas solo en destino nuevo; carga atómica y comparación de contenido además de cantidades | Crear → verificar SHA-256 → restaurar desde navegador: **48 tablas, 1.382 filas y 48 coincidencias de contenido**. Ventas de la base activa conservadas. |
| NAT-UAT-02: terminados excluidos de inventario administrativo | Selectores y validaciones del servidor admiten productos terminados en compras, traslados y consumo; conteos los incluyen en pantalla. Se conservan conversiones, permisos e idempotencia | Compra de 3 unidades por $6.000 agrega 3; despacho de 2 resta 2 en Centro y recepción de 1 + 1 suma 2 en Milán; conteo 8 → 7 y consumo de 1 deja 6, sin crear ventas. |
| NAT-UAT-03: filtros incompletos en Informes | Carga de todas las páginas de productos, clientes y proveedores, respetando el contrato de paginación de cada API y el alcance por sede | 254 productos, 120 clientes y 120 proveedores de Centro disponibles. Producto fuera de la primera página filtra una venta de $10.000 y exporta una fila. Milán ofrece solo su proveedor y reinicia los filtros. |

La revisión encontró que NAT-UAT-02 también estaba en las validaciones del servidor: corregir solo los selectores no bastaba. En NAT-UAT-01, cambiar el orden tampoco bastaba para asegurar fidelidad: los datos iniciales de la base restaurada podían diferir y faltaba una tabla de costos.

La prueba de integración de respaldo comprueba también archivo alterado, tabla requerida ausente, destino existente, referencia inválida, rollback de toda la carga y conservación de las protecciones de historial. Un respaldo antiguo incompleto se rechaza explícitamente con `backup_incomplete`; requiere generar uno nuevo. Si una restauración falla, su destino aislado se conserva para diagnóstico y no se sobrescribe en otro intento.

## Verificación ejecutada

| Comando / conjunto | Resultado | Alcance |
| --- | --- | --- |
| `npm.cmd run check` | Aprobado, salida 0 | Tipos, 56 pruebas unitarias, 64 pruebas de integración y compilación. Incluye la regresión ampliada de respaldo. |
| `node --test tests/integration/catalog.test.ts` | **16 pruebas aprobadas**, salida 0 | Reejecución después del ajuste final del servidor; incluye regresión nueva de terminados, conversión inválida, permisos y reintentos. Se solapa con la suite anterior; no son 16 escenarios adicionales independientes. |
| `npm.cmd run typecheck` | Aprobado, salida 0 | Código final del producto, pruebas y ejecutor. |
| `npm.cmd run test:workflows`, seguido de `node scripts/validate-workflows.ts` | **18 casos aprobados, 0 fallidos**, salida 0 en la ejecución final | Formularios y operaciones reales de navegador sobre datos sintéticos. El segundo comando repitió el recorrido tras ajustar la automatización del cambio de sede. |
| `npm.cmd run test:e2e` | **Aprobada en la versión final**, salida 0; 1 prueba principal con múltiples recorridos, 3,3 minutos totales | Suite general de navegador, escritorio/móvil, temas, permisos, caja, devoluciones, fidelización, inventario y recuperación offline. |

El recorrido adicional cubre venta de terminado y cambio; preparación con sustitución/adicional; cliente, descuento, propina, domicilio y puntos; desperdicio; archivo/restauración de catálogo; conciliación de costo; compra, traslado y conteo/consumo de terminados e insumos; saldo negativo; cierre offline con diferencia; permisos; importación; exportación y respaldo.

Los ensayos intermedios también corrigieron errores del ejecutor: esperas de selectores, precondiciones sintéticas y la vuelta de Informes a Ventas al cambiar de sede. No se presentan esos errores como defectos del producto ni se alteró ese comportamiento para hacer pasar la prueba.

## Evidencias conservadas

- [Compra de terminado](correccion-flujos-2026-09-25/B13-T.png), [traslado recibido](correccion-flujos-2026-09-25/B14-T.png) y [conteo/consumo](correccion-flujos-2026-09-25/B15-T.png).
- [Filtro de producto fuera de la primera página](correccion-flujos-2026-09-25/B18-producto-fuera-primera-pagina.png) y [Excel filtrado](correccion-flujos-2026-09-25/producto-fuera-primera-pagina.xlsx).
- [Excel de caja con 121 filas frente a 20 en pantalla](correccion-flujos-2026-09-25/caja-exportada.xlsx).
- [Restauración confirmada en pantalla](correccion-flujos-2026-09-25/B24.png) y [conciliación de las 48 tablas](correccion-flujos-2026-09-25/restoration-reconciliation.json).
- Suite general final: [comprobante tras reiniciar offline](correccion-flujos-2026-09-25/suite/offline-restart-receipt.png), [cuenta dividida](correccion-flujos-2026-09-25/suite/desktop-split-receipt.png), [devolución móvil](correccion-flujos-2026-09-25/suite/mobile-refund.png) y [puntos](correccion-flujos-2026-09-25/suite/desktop-points-receipt.png).
- [Respuestas HTTP registradas](correccion-flujos-2026-09-25/server-errors.json): rechazo intencional de recepción excesiva y consulta de transición local no disponible. [Registro de errores PostgreSQL](correccion-flujos-2026-09-25/database-errors.txt) vacío en la ejecución final.
- [Ejecutor reproducible](../../scripts/validate-workflows.ts), disponible mediante `npm.cmd run test:workflows`.

## Límites que permanecen

El sitio publicado no incluye todavía estas correcciones por esta intervención. Las 17 recetas pendientes detectadas en el catálogo publicado son datos del negocio: no se inventaron recetas para habilitarlas. Tampoco se configuró el respaldo local del sitio alojado ni se ensayó PITR externo de Railway.

Se conservan las variantes parciales y pendientes del informe inicial: impresoras/cajones físicos, aceptación presencial del personal, todas las combinaciones de exportación por rol y otras variantes allí identificadas. Pasar estas regresiones no sustituye esas comprobaciones ni autoriza un lanzamiento.
