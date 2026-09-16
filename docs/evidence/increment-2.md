# Evidencia — Incremento 2: Catálogo y existencias

Fecha: 14-09-2026, America/Bogota. Autorización: «Continúa con el incremento 2 de nuestro sistema para Nativos», reiterada con «Continúa implementando el incremento 2». Estado: verificado localmente en el alcance de la hoja de ruta; no publicado.

## Resultado

Catálogo compartido de productos terminados/preparados, edición por versión, impuesto opcional (null distinto de 0% y exento), artículos de materia prima/consumibles y recetas por presentación. Formularios de receta con ingredientes, empaques, adicionales, sustituciones e instrucciones. Borradores conservan pendientes; activación valida cantidad/conversión/precio de opciones y congela consumo base. Un borrador posterior no retira la receta activa. Historia consultable por API.

Existencias y mínimos por bodega, conversión de entrada, inicial único vigente, reversión relacionada y nueva entrada correctiva. Costos iniciales opcionales y costo base de receta disponibles únicamente al dueño; desconocidos permanecen pendientes. El libro conserva la cantidad original/unidad/factor/fuente, la cantidad base y la relación de reversión. No se modifica el maestro ni Alegra.

Mutaciones autenticadas y autorizadas por servidor, con clave de operación/reintento, conflicto optimista, auditoría y persistencia en una sola transacción. Recetas, versiones de producto, movimientos y respuestas de operación protegidos contra cambios destructivos normales mediante triggers PostgreSQL. No se afirma resistencia contra un administrador que altere el esquema.

Planes y tareas de 002/003 y contratos completados antes de escribir código dependiente. DEC-017 registra precisión, costo inicial y recuperación. Sin nuevas dependencias ni cambios de lockfile.

## Verificación ejecutada

| Comando / comprobación | Resultado |
| --- | --- |
| npm.cmd run check | TypeScript estricto, 21 pruebas de dominio, 19 subescenarios de integración PostgreSQL real y compilación aprobados |
| npm.cmd run typecheck + npm.cmd run build | Aprobados después de los últimos ajustes exclusivamente visuales |
| npm.cmd run test:e2e | 1 flujo extendido fundamentos + incremento 2, aprobado en Edge; última ejecución 32,7 s de prueba, 51,7 s total |
| Reinicio de PostgreSQL de integración | Saldos e historia conservados; migraciones repetidas válidas |
| Snapshot lógico de pruebas exportado/restaurado | Segunda base recién migrada: datos/recetas/saldos y auditoría sintéticos importados mediante SQL; API conserva resultados |
| Reinicio de desarrollo | Migración 002 aplicada sobre base existente; /api/status mantiene setupRequired=true y nueva ruta de productos exige sesión (401) |
| Exposición de desarrollo | Solo 127.0.0.1:4310 y 127.0.0.1:54329 |

Node 24.15.0, npm 12.0.2 y PostgreSQL 18.4 corresponden al entorno de fundamentos; dependencias fijadas en package-lock.json sin modificaciones. Node cuenta 21 resultados de integración incluyendo las dos suites padre: son 19 escenarios, no 21 escenarios independientes. No pruebas omitidas.

## Trazabilidad

- AC-002-06: alta por cajero, null tributario, producto terminado con artículo asociado, producto preparado pendiente de receta; edición y respuesta idempotente concurrente.
- AC-002-02/07: borrador con cantidad/conversión incompleta; activación rechazada con línea indicada; publicación conserva versiones, conflicto optimista y borrador posterior conserva receta activa.
- AC-002-07 en dominio: sustitución consume el reemplazo, adicional agrega cantidad/precio, empaque permanece; selección duplicada y dos sustituciones para la misma línea rechazadas. No se afirma cobro real.
- AC-003-01/06: conversión 1 kg → 1.000 g exacta, mínimo, inicial único, reintento concurrente, reversión con referencia y reinicialización; saldo y paginación comprobados.
- AC-003-07: encargado/cajero reciben 403 para costos; escritura de costo por encargado rechazada; respuestas públicas sin costo. Costo cero explícito distinto de desconocido; receta base con todos los costos conocidos se calcula exactamente.
- AC-003-08: fallo inducido en auditoría revierte alta de producto y reversión de inventario; no deja respuesta idempotente huérfana. Reintento posterior funciona. Protección de historia, reinicio y restauración de fixture lógico verificadas.
- REQ-001-05: formularios y navegación probados, foco/Tab/Escape, botones de guardado accesibles mediante desplazamiento, sin desbordamiento horizontal en tamaños evaluados.

Código/pruebas: src/catalog.ts, src/server/catalog-api.ts, migrations/002-catalog-inventory.sql, web/Catalog.tsx, tests/catalog.test.ts, tests/integration/catalog.test.ts y tests/e2e/catalog-flow.ts. OpenAPI consumido tanto por servidor como por validadores de respuestas de integración: contracts/catalog-inventory-v1.json.

## Interfaz y capturas

Se revisaron las doce capturas de Productos, Recetas e Inventario en escritorio/móvil y claro/oscuro, además de formularios móviles de producto y receta. Archivos bajo [increment-2](increment-2/). Axe: sin infracciones WCAG 2 A/AA y 2.1 AA en esas doce vistas y los dos formularios evaluados. Esto no certifica todos los estados futuros de la aplicación.

Ejemplos: [productos escritorio](increment-2/desktop-light-productos.png), [recetas oscuro](increment-2/desktop-dark-recetas.png), [inventario móvil](increment-2/mobile-light-inventario.png), [formulario receta](increment-2/mobile-recipe-form.png). Datos y nombres son sintéticos. Regresión de fundamentos se captura en increment-2/foundation-regression; las evidencias históricas del incremento 1 se conservaron.

La prueba E2E detectó el nombre accesible incorrecto del selector de tipo. Se corrigieron los selectores nuevos con nombres explícitos y se repitió el flujo completo. También se corrigió la presentación de cantidades para quitar ceros de relleno y se conservan campos parciales de conversión sin asignar factores supuestos.

## Límites y siguiente paso

Sin cobros, pedidos, descuento real por venta, Electron/SQLite, firma offline, sincronización comercial, compras/traslados/conteos, promedio ponderado ante negativos, Excel, impresión, WhatsApp ni migración de datos operativos. Preparados habilitados significa que cumplen requisitos de catálogo; la caja se implementará en incremento 3. Conservar pedidos durante altas y versiones aplicadas a una venta siguen como aceptaciones integrales pendientes.

Costo de receta mostrado: receta base según inicial de la bodega de venta del local elegido, sin opciones; no se presenta como costeo promedio de compras. DEC-005 permanece pendiente para negativos y entradas tardías. Cantidades, conversiones, precios y tasas reales deberán revisarse antes de carga operativa.

El runtime no incluye pg_dump. La recuperación comprobada exporta/importa un fixture lógico sintético usando SQL y valida una base nueva; no entrega una herramienta de backup operativo ni demuestra recuperación ante pérdida del disco. Respaldo/restauración operativa queda en incremento 6.

Desarrollo quedó ejecutándose en http://127.0.0.1:4310 con primer acceso pendiente; no se creó cuenta del dueño ni productos reales. Los clústeres de pruebas quedaron detenidos. Siguiente: incremento 3, primera venta completa, dentro de la autorización local existente.

## Identidad de la entrega

Base Git: d33a686. El [manifest SHA-256](increment-2/source-sha256.json) identifica archivos fuente/contratos/configuración/pruebas de esta entrega, con CRLF normalizado a LF. No incluye datos locales ni credenciales. Los cambios permanecen en el árbol de trabajo para revisión.
