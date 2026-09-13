# 002 — Catálogo y recetas

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, secciones 4 y 6.

## Requisitos

- REQ-002-01: todos los usuarios crean online productos mediante formulario completo sin perder el pedido. Solo existen los tipos comerciales Producto Terminado y Producto Preparado; materias primas y consumibles se administran según inventario.
- REQ-002-02: conservar nombre, referencia, categoría, unidad, presentación, precio final, impuestos y descripción; costos sujetos a 001. Impuestos es opcional: permitir guardar y vender con el campo en blanco, mostrando «Sin impuesto asignado» y sin calcular impuesto para ese producto. Conservar vacío distinto de tasa 0% o exención fiscal; no inferir tasas.
- REQ-002-03: crear recetas con producto/presentación, ingredientes, cantidades, unidades, empaques, adicionales, sustituciones e instrucciones; permitir borrador y activación.
- REQ-002-04: impedir activación si faltan cantidades o conversiones. La sustitución consume el ingrediente elegido; los adicionales aportan consumo y precio.
- REQ-002-05: compartir catálogo y recetas entre locales y versionar cambios; una venta conserva la versión aplicada.

## Estados y fronteras

Receta borrador → activa. Definir transición de un producto preparado sin receta vendible. No inferir una conversión gotas/ml o gramos/ml sin fuente válida. El catálogo entrega versiones a 004 y 007; 003 resuelve consumo en unidades base.

## Aceptación

- AC-002-01 → REQ-002-01/02. Dado un pedido abierto, cuando un cajero crea un Producto Terminado válido online, entonces el producto queda disponible y el pedido conserva sus líneas.
- AC-002-02 → REQ-002-03/04. Dada una receta con ingrediente sin conversión necesaria, cuando se intenta activar, entonces se identifica el campo pendiente y el producto no se habilita por esa receta; guardar borrador sí es posible.
- AC-002-03 → REQ-002-04. Dada una receta sintética que usa 100 ml de leche entera, cuando se sustituye por 100 ml de otra leche y se cobra, entonces se consume la elegida y no la original.
- AC-002-04 → REQ-002-05. Dada una venta con receta v1, cuando se publica v2, entonces la consulta y sincronización de esa venta siguen reflejando v1.

## Dependencias y pendientes

001 para permisos; 003/004/007 para contratos compartidos. Conversiones, precios e impuestos reales siguen pendientes; no usar cantidades ilustrativas como recetas de producción. Evidencia: pendiente.

## Aclaración de asignación de impuestos

- AC-002-05 → REQ-002-02. Dado un producto nuevo sin configuración tributaria, cuando se guarda online, entonces conserva sus datos y el campo vacío, muestra «Sin impuesto asignado» y permite vender si cumple los demás requisitos. No convierte el vacío en una tasa cero ni en exención fiscal. Cuando se asigna un impuesto posteriormente, se versiona el cambio según REQ-002-05 sin alterar ventas anteriores.

La indicación del usuario de permitir el campo en blanco sustituye la propuesta de bloqueo. AC-002-01 admite impuesto vacío. Para preparados se mantiene la exigencia de receta y conversiones completas.
