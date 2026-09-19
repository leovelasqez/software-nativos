# 016 — Caja enfocada en la operación

Estado: Verificada localmente. Autorización: el usuario solicita implementar todas las mejoras de la revisión de UI y comprobarlas en navegador, corrigiendo lo necesario.

## Objetivo y alcance

Mejorar venta, catálogo, pedido, cobro y estados sin cambiar las reglas comerciales, permisos, persistencia ni protocolo offline. Conservar identidad, verde #00bf63, navegación lateral y temas.

## Requisitos y aceptación

- REQ-016-01 / AC-016-01: cabecera compacta con sucursal, turno y conexión. En escritorio catálogo y líneas tienen desplazamiento propio y total/cobro permanecen visibles; en móvil menú desplegable, vistas Productos/Pedido y resumen inferior. Verificar escritorio 1366×768, tablet 1024×768 y móvil 390×844, con pedidos y catálogo largos.
- REQ-016-02 / AC-016-02: categorías, búsqueda por nombre/referencia tolerante a tildes/espacios, contador, limpiar y vacío explicativo. Comprobar búsqueda y filtros combinados, categoría vacía y recuperación.
- REQ-016-03 / AC-016-03: líneas con importe y cantidad destacados, descuentos/notas condicionales, estado de preparación y edición accesible de cantidad sin reducir enviadas por edición. Pedido identificable por atención, nombre/mesa, cliente y monto; plural correcto e ID secundario.
- REQ-016-04 / AC-016-04: cobro completo por defecto, división explícita, fidelización desplegable y confirmación visible. Conservar cliente por cobro, selección parcial, puntos, propina y envío. Probar cobro completo y parcial con persistencia.
- REQ-016-05 / AC-016-05: Total/Recibido/Falta/Cambio vivos con precisión compartida y regla de cambio exclusivamente efectivo; Importe exacto completa explícitamente el medio seleccionado descontando los otros pagos. No sobrescribir importes al cambiar total; rechazar duplicados, inválidos y excedentes digitales.
- REQ-016-06 / AC-016-06: texto legible, acciones ocupadas diferenciadas de indisponibles, razones próximas a acciones bloqueadas, información técnica desplegable y estados con icono/texto para sincronizado, pendiente y offline. Verificar conexión perdida, turno cerrado/ajeno y recuperación pendiente.
- REQ-016-07 / AC-016-07: escritorio/móvil, claro/oscuro, teclado, foco y formularios accesibles sin desbordamiento horizontal; capturas revisadas y regresiones críticas de Caja.
- REQ-016-08 / AC-016-08: sustituir el desplegable por pestañas inferiores, siguiendo la referencia de Alegra aportada el 19-09-2026. Mostrar Venta principal y ventas numeradas de forma estable, o su nombre/mesa; seleccionar sin perder contenido, agregar con + y cerrar con ×. Confirmar el cierre de pedidos vacíos sin efectos monetarios ni de inventario; pedidos con productos usan la cancelación existente con motivo y cantidades preparadas. Cerrar una pestaña inactiva conserva la selección; cerrar la activa selecciona una vecina; cerrar la última deja una venta nueva disponible. Persistir cierres y selección offline, conservando auditoría y reintentos. Probar teclado, desbordamiento de muchas pestañas y móvil sin cubrir Cobrar.

## Dependencias y datos

Extiende 001/004/005/006/012/015 y DEC-021. No agrega API ni migración. Se reutilizan checkout, paymentTotals, decimal y formatted. Las mutaciones siguen usando order.save, order.cancel y sale.split con revisión e idempotencia. Cantidades enviadas se reducen exclusivamente por cancelación y desperdicio existentes.

## Evidencia

[Evidencia y capturas](../../docs/evidence/caja-ui.md). Ver plan.md y tasks.md.
