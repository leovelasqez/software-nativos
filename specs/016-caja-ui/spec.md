# 016 — Caja enfocada en la operación

Estado: Verificada localmente. Autorización: el usuario solicita implementar todas las mejoras de la revisión de UI y comprobarlas en navegador, corrigiendo lo necesario.

## Objetivo y alcance

Mejorar venta, catálogo, pedido, cobro y estados sin cambiar las reglas comerciales, permisos, persistencia ni protocolo offline. Conservar identidad, verde #00bf63, navegación lateral y temas.

## Requisitos y aceptación

- REQ-016-01 / AC-016-01: cabecera compacta con sucursal, turno y conexión. Por solicitud del 24-09-2026, en escritorio el catálogo conserva desplazamiento propio y el pedido crece sin scroll interno; con tres líneas en 1366×596 se ven productos, total y acciones completos, y los pedidos que superan la pantalla usan el desplazamiento del espacio de trabajo; en móvil menú desplegable, vistas Productos/Pedido y resumen inferior. Verificar escritorio 1366×768, tablet 1024×768 y móvil 390×844, con pedidos y catálogo largos.
- REQ-016-02 / AC-016-02: categorías, búsqueda por nombre/referencia tolerante a tildes/espacios, contador, limpiar y vacío explicativo. Comprobar búsqueda y filtros combinados, categoría vacía y recuperación.
- REQ-016-03 / AC-016-03: líneas con importe y cantidad destacados, descuentos/notas condicionales, estado de preparación y edición accesible de cantidad sin reducir enviadas por edición. Pedido identificable por atención, nombre/mesa, cliente y monto; plural correcto e ID secundario.
- REQ-016-04 / AC-016-04: cobro completo por defecto, división explícita, fidelización desplegable y confirmación visible. Conservar cliente por cobro, selección parcial, puntos, propina y envío. Probar cobro completo y parcial con persistencia.
- REQ-016-05 / AC-016-05: Total/Recibido/Falta/Cambio vivos con precisión compartida y regla de cambio exclusivamente efectivo; Importe exacto completa explícitamente el medio seleccionado descontando los otros pagos. No sobrescribir importes al cambiar total; rechazar duplicados, inválidos y excedentes digitales.
- REQ-016-06 / AC-016-06: texto legible, acciones ocupadas diferenciadas de indisponibles, razones próximas a acciones bloqueadas, información técnica desplegable y estados con icono/texto para sincronizado, pendiente y offline. Verificar conexión perdida, turno cerrado/ajeno y recuperación pendiente.
- REQ-016-07 / AC-016-07: escritorio/móvil, claro/oscuro, teclado, foco y formularios accesibles sin desbordamiento horizontal; capturas revisadas y regresiones críticas de Caja.
- REQ-016-08 / AC-016-08: sustituir el desplegable por pestañas inferiores, siguiendo la referencia de Alegra aportada el 19-09-2026. Mostrar Venta principal y ventas numeradas de forma estable, o su nombre/mesa; seleccionar sin perder contenido, agregar con +, cambiar el nombre visible y cerrar con ×. Cerrar pedidos vacíos inmediatamente, sin aviso ni efectos monetarios o de inventario; solo los pedidos con productos usan la confirmación de cancelación existente, con motivo y cantidades preparadas. Cerrar una pestaña inactiva conserva la selección; cerrar la activa selecciona una vecina; cerrar la única pestaña —incluso si aún es virtual— deja cero pestañas abiertas hasta pulsar +, también después de sincronizar o recargar offline. Cerrar una venta virtual no crea pedidos ni incrementa la numeración. Persistir nombres, cierres y selección offline, conservando auditoría y reintentos. Probar teclado, desbordamiento de muchas pestañas y móvil sin cubrir Cobrar.

- REQ-016-09 / AC-016-09: controles − / cantidad / + directamente en cada línea. Cada pulsación suma o resta una unidad con precisión decimal y recalcula importes mediante order.save sin abrir el editor. Deshabilitar − cuando la cantidad es menor o igual a una; conservar Quitar para eliminar y el número central para escribir cantidades. Si hay unidades enviadas, − abre la cancelación existente con una unidad preseleccionada, motivo y cantidad preparada, sin guardar una reducción por edición. Bloquear controles durante guardado, conciliación o canje pendiente. Comprobar totales, fracciones, ausencia de modal en líneas no enviadas y el flujo de preparación.

## Dependencias y datos

Extiende 001/004/005/006/012/015 y DEC-021. No agrega API ni migración. Se reutilizan checkout, paymentTotals, decimal y formatted. Las mutaciones siguen usando order.save, order.cancel y sale.split con revisión e idempotencia. Cantidades enviadas se reducen exclusivamente por cancelación y desperdicio existentes.

## Evidencia

[Evidencia y capturas](../../docs/evidence/caja-ui.md). Ver plan.md y tasks.md.

Actualización del 24-09-2026: cabecera unificada, estado de conexión e inventario desplegable, catálogo y pedido ampliados, controles de cantidad. El usuario autorizó expresamente commit, subida a GitHub y despliegue manual en Railway.

Extensión del 24-09-2026 publicada en Railway y verificada: [evidencia](../../docs/evidence/caja-space-2026-09-24.md).

REQ-016-10 / AC-016-10 (solicitud posterior del 24-09-2026): Quitar retira inmediatamente toda la línea no enviada, sin formulario, confirmación ni motivo manual. Usar order.cancel con motivo automático y preparedQuantity=0 para conservar auditoría, revisión e idempotencia; actualizar total y persistir offline. Para líneas enviadas se conserva el registro de preparación/desperdicio. Cancelar la venta completa conserva su flujo.
