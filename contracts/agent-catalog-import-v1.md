# Contrato v1 — Importación de catálogo y recetas por agente

Estado: diseño para TASK-010-04. Esta importación crea productos nuevos; no actualiza productos, recetas ni precios existentes. Las modificaciones usan las rutas versionadas normales para no sobrescribir historia por lote.

## Lote

`POST /api/agent/v1/imports/catalog/preview` y `/confirm` reciben `operationId`, `branchId`, `reason`, `rows` y, en confirmación, `previewFingerprint`. Cada fila contiene `{row, product, recipe}`. `product` conserva el contrato de producto vigente: nombre, referencia, categoría, presentación, tipo, precio decimal, impuesto opcional y descripción. La referencia es única sin distinguir mayúsculas/minúsculas.

Para un producto `finished`, el servidor crea a la vez el artículo terminado del mismo ID. Para un `prepared`, `recipe` es obligatoria, se crea como versión 1 activa y debe incluir al menos un ingrediente válido. Cada línea de receta conserva artículo, cantidad, unidad y conversión cuando no es métrica; las opciones conservan su tipo, línea sustituida y precio adicional. Se usa `freezeRecipe` para validar cantidades, conversiones, sustituciones y consumo.

## Consistencia

Vista previa valida todas las referencias, duplicados en el lote, referencias ya existentes y recetas antes de confirmar. La confirmación crea productos, artículos terminados, versiones y recetas en una sola transacción; si una fila falla, ninguna fila persiste. Reintentar el mismo actor, `operationId` y fingerprint devuelve el mismo resultado. Un producto preparado no se publica sin receta activa; no se inventan tasas, costos, conversiones ni sustituciones.

La respuesta por fila es `{row, productId, recipeId|null, version}`. Auditoría conserva actor agente, operación, sucursal y resumen de filas, sin token ni contenido sensible.
