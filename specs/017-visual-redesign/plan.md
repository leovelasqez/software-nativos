# Plan técnico de 017

Estado: Implementado y verificado localmente, diseño aprobado el 19-09-2026.

1. Tokens y componentes compartidos, Inter e iconos React empaquetados. Rehacer layout administrativo y ajustar Caja sobre la distribución operativa de 016.
2. GET /api/dashboard, autenticación/data.read, instantánea PostgreSQL REPEATABLE READ READ ONLY. Agregar todo el período, no una página del reporte. Separar cálculo exacto de representación; no enviar ventas completas ni costos/clientes.
3. Dashboard con indicadores/gráfica/ranking/alertas, última sincronización y carga/error/vacío. Opción all solo en consultas que lo soportan; formularios conservan sucursal concreta.
4. Móvil con consultas directas de ventas/inventario. Conservar acceso a otros módulos y funciones de Caja; no introducir bloqueo por ancho de pantalla.
5. Verificar regresiones e integración de cifras/permisos y recorridos de navegador de diseño por módulo/tema/tamaño. Usar la suite E2E existente y Playwright CLI para la revisión adicional.

Contrato: ../../contracts/dashboard-v1.md. API aditiva, sin migración ni cambios de escritura. Vite incluye WOFF2/iconos en assets precargados por build-offline.ts. No limpiar almacenamiento ni reemplazar perfiles.

## Implementación

- `web/theme.css` fija una sola cascada font → estilos base → reglas operativas de Caja → diseño aprobado. Ambos puntos de entrada la importan; así Vite no coloca reglas antiguas de Caja detrás de los tokens nuevos.
- Inter Variable 5.3.0, subconjunto Latin local de 48,25 kB; iconos de lucide-react 1.47.0. Sin CSS/fuentes remotas ni imágenes ilustrativas de productos que no existen.
- `src/dashboard.ts` agrega decimales con bigint. `src/server/dashboard-api.ts` consulta ventas, devoluciones y mínimos dentro de una sola instantánea autorizada.
- `web/Dashboard.tsx` conserva carga/error/vacío, descarta respuestas anteriores, genera la gráfica con tabla accesible y abre la sucursal/bodega de la alerta. “Todas” se ofrece solo en Resumen; formularios y módulos operativos conservan una sucursal concreta.
- `web/Reports.tsx` conserva filtros/exportación/datos, mostrando columnas resumidas y detalles completos con etiquetas españolas. `web/report-format.ts` separa importes, cantidades y fechas sin alterar la API.
- Menú administrativo desplazable con marca/cuenta persistentes. Móvil: accesos rápidos Ventas e Inventario. Caja conserva las mecánicas de altura y desplazamiento de 016.

Evidencia: [verificación 017](../../docs/evidence/visual-redesign.md). La revisión utiliza bases sintéticas aisladas, no movimientos comerciales.

## Corrección de impresión — AC-017-06

Identificar el diálogo del comprobante con `receipt-dialog`. En impresión, retirar del flujo los hermanos de ese diálogo mediante `display:none`, sustituir alturas y posicionamiento de pantalla por flujo normal y limitar el contenido a 72 mm imprimibles. Usar el tamaño de papel del controlador (`@page size:auto`); la declaración anterior `80mm auto` no es válida. Reemplazar el grid del recibo por bloques compactos y evitar cortes dentro de cada producto. Omitir renglones de opciones/notas vacíos conservando todos los importes.

Comprobar paginación PDF de 72,1 × 210 mm con 300 productos de catálogo detrás del diálogo y comprobantes sintéticos cortos/largos. Extraer texto para comprobar que no se pierde el total ni el cambio. Sin cambios a API, contratos, IndexedDB o migraciones. Publicar desde un archivo Git del commit verificado, excluyendo archivos locales ajenos; comprobar `/health`, `/caja` y hashes de los assets publicados.
