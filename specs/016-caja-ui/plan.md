# Plan técnico de 016

Estado: Verificada localmente. Alcance completo de spec.md autorizado en esta tarea.

## Diseño

Pos.tsx organiza una cabecera operativa, catálogo filtrable y pedido. pos-workspace.css, cargado después del diseño compartido, compacta la cabecera y permite que el pedido crezca sin scroll interno. El catálogo usa la altura disponible del contenedor y conserva su desplazamiento. Se mantiene el resumen inferior móvil. Menú móvil desplegable con controles accesibles. Metadatos editables desde la cabecera del pedido. Detalles técnicos en details.

OrderForms.tsx conserva formulario y dominio: división y fidelización se expanden explícitamente; pie de cobro visible con cálculo vivo. Helpers puros en web/pos-ui.ts normalizan búsqueda y calculan resumen de pago exacto reutilizando catálogo/orders-domain, sin persistir valores derivados. No dependencias nuevas.

## Contratos y recuperación

Sin cambios a contratos browser-pos-v1, orders-v3 ni loyalty-v1. Sin migraciones, borrado de datos ni nueva caché. Conserva eventos y validación del motor/servidor. Al cerrar cobro sin confirmar se conserva pedido; pagos editados no se reescriben automáticamente.

## Pruebas

### Extensión de pestañas (AC-016-08)

OrderTabs.tsx reemplaza el selector con una barra inferior desplazable, selección por teclado, cambio de nombre y cierre independiente. El motor deriva números estables del historial de pedidos del actor (incluidos cerrados) sin migración ni campos comerciales nuevos. El nombre usa el `label` existente mediante `order.save`; el botón visible y F2 abren un formulario accesible. Cerrar conserva la selección activa cuando el objetivo es otra pestaña. `order.cancel` ya admite `lines` vacío en los schemas v2/v3; el dominio lo acepta exclusivamente si el pedido también está vacío, conservando motivo, revisión, autorización e idempotencia. No se borra ningún pedido ni operación. El cierre vacío no pide confirmación; al cancelar la última venta, selected[actorId] guarda un marcador vacío y el estado expone noOpenSale. Si la venta es virtual, /v2/dismiss-draft guarda ese marcador bajo Web Lock sin crear pedidos ni eventos comerciales. La pantalla vacía conserva +; crear desde ella guarda exactamente una venta. El marcador persiste en el perfil cifrado y no oculta pedidos reales concurrentes. `+` también guarda la venta virtual antes de abrir una segunda pestaña. Pruebas de dominio, integración central y regresión de navegador sobre datos sintéticos.

Tests unitarios para búsqueda y resumen de pagos con efectivo/digital combinados, insuficiencia, exceso digital, entradas inválidas e importe exacto. E2E de UI y regresión de Caja, división, puntos, offline y reapertura existentes. Revisar capturas reales y axe, foco/teclado, scroll y visibilidad de cobro. Ejecutar typecheck, tests, integración y build. No acredita hardware ni despliegue.

## Ajuste de espacio y cantidades — 24-09-2026

REQ/AC-016-01/03/06/07/09. Estado, pendientes y aviso de inventario se agrupan en la cabecera, con detalles desplegables; los errores bloqueantes siguen visibles. Los botones de cantidad usan decimal/formatted y el mismo guardado idempotente de la edición. Para unidades enviadas se reutiliza CancelForm con initialQuantity=1; Quitar conserva su cantidad completa predeterminada. No cambian contratos, servidor, migraciones ni esquemas locales. Los pedidos excepcionalmente largos desplazan el espacio de trabajo; no se promete encajar un número ilimitado de líneas en una pantalla.

Publicar desde un checkout limpio del commit para excluir el trabajo de importación Excel pendiente. Ejecutar typecheck, pruebas, integración, build y el recorrido E2E. Desplegar directamente al servicio nativos-web en production, verificar estado SUCCESS, /health y hashes de los recursos públicos. Conservar IndexedDB y pedidos del navegador.

AC-016-10: centralizar Quitar en un manejador que revise los bloqueos existentes; para sentQuantity=0 enviar order.cancel de toda la línea con razón descriptiva automática y cero preparado. Para líneas enviadas abrir CancelForm. Verificar ausencia de modal, total, recarga offline y conservación del resto del pedido en E2E. Sin cambios de dominio ni migraciones.
