# Importación de catálogo desde Excel

En **Productos → Importar Excel** se descarga la plantilla y se carga un `.xlsx`.
El usuario indica un motivo, valida, revisa productos/insumos/recetas y confirma.
La validación no modifica el catálogo: guarda una vista previa privada por 30 minutos.
Solo una confirmación válida crea insumos, productos y recetas, en una transacción.

## Formato

La definición compartida de encabezados vive en `src/catalog-import.ts`.
Se aceptan las hojas **Productos**, **Recetas**, **Ingredientes**, **Opciones** e
**Insumos nuevos**. Las tres primeras deben existir, aunque pueden estar vacías
en una carga exclusivamente de insumos. Opciones e Insumos nuevos son opcionales.
Los encabezados van en la fila 1; las columnas pueden reordenarse, conservando
sus nombres. Las filas vacías, incluso con formatos, se ignoran.

**Instrucciones**, **Campos**, **Ejemplos** e **Insumos disponibles** son auxiliares
y no se importan. La descarga incluye una consulta de materias primas y consumibles
activos; esa hoja nunca sustituye la consulta autorizada a la base de datos.
Archivos con otra estructura deben adaptarse a la plantilla. No se intenta
interpretar silenciosamente hojas maestras o archivos de Alegra.

Se usan referencias de texto, importes COP y cantidades numéricas con hasta seis
decimales. Las cantidades son por unidad vendida. La unidad base es `g`, `ml` o
`unit`; `kg` y `l` se convierten automáticamente. Otras unidades necesitan una
equivalencia documentada. Las sustituciones apuntan al código de una línea de
la misma receta. Se reutiliza `freezeRecipe` para preservar las reglas de consumo
y las versiones empleadas por Caja.

## Límites y permisos

- 5 MB de archivo, 50 MB descomprimidos y hasta 1.000 entradas ZIP.
- 1.000 productos, 2.000 insumos nuevos y 20.000 filas de datos por archivo.
- 100 líneas y 100 opciones por receta; hasta 1.000 errores en cada respuesta.
- Solo altas. No sobrescribe registros, no restaura archivados ni carga costos,
  compras o existencias. El catálogo es compartido entre sedes.
- Sesión humana y `product.create`; también `recipe.create` si hay recetas,
  `inventory.manage` si hay insumos nuevos y `data.read` para descargar la plantilla.
- No se aceptan macros, contraseñas, fórmulas, fechas ni objetos en celdas de datos.

## API y persistencia

- `GET /api/catalog/imports/template?branchId=...`: plantilla XLSX.
- `POST /api/catalog/imports/preview`: JSON `{branchId, reason, fileName, content}`;
  `content` contiene el archivo en base64. Devuelve ubicación de errores, resumen,
  detalle revisable y `previewId` cuando es válido.
- `POST /api/catalog/imports/confirm`: JSON `{previewId}`. El servidor confirma
  exclusivamente el contenido guardado, verifica nuevamente permisos, referencias
  y estado de los insumos, y toma el bloqueo transaccional del catálogo.

`excel_catalog_imports` conserva el lote normalizado y el resultado. Confirmaciones
repetidas del mismo identificador devuelven el mismo resultado, incluso si se perdió
la primera respuesta. Otro usuario no puede consultar ni confirmar esa vista previa.
Una vista previa caducada o un catálogo cambiado exige nueva validación. Las vistas
previas vencidas sin confirmar se eliminan al generar una nueva para el mismo usuario.
El evento `catalog.excel_imported` registra motivo, archivo, conteos e IDs creados.
La tabla se incluye en el respaldo lógico. La migración es `020-excel-catalog-import.sql`.

Las pruebas `tests/excel-catalog.test.ts` y `tests/integration/excel-import.test.ts`
utilizan archivos sintéticos y PostgreSQL aislado. Cubren interpretación, conversiones,
errores, límites, falta de permisos, rollback tras fallo tardío, caducidad, cambios
concurrentes e idempotencia. No leen ni importan archivos comerciales del workspace.

ExcelJS 4.4.0 se utiliza en el servidor; `yauzl` valida límites y tamaños reales
antes de interpretarlo. El override de `uuid` para ExcelJS elimina la versión
afectada por GHSA-w5hq-g745-h8pq sin cambiar su uso de UUID v4.
