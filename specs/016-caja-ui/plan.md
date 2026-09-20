# Plan técnico de 016

Estado: Verificada localmente. Alcance completo de spec.md autorizado en esta tarea.

## Diseño

Pos.tsx organiza una cabecera operativa, catálogo filtrable y pedido. pos.css limita el desplazamiento a las listas en escritorio y conserva resumen inferior móvil. Menú móvil desplegable con controles accesibles. Metadatos editables desde la cabecera del pedido. Detalles técnicos en details.

OrderForms.tsx conserva formulario y dominio: división y fidelización se expanden explícitamente; pie de cobro visible con cálculo vivo. Helpers puros en web/pos-ui.ts normalizan búsqueda y calculan resumen de pago exacto reutilizando catálogo/orders-domain, sin persistir valores derivados. No dependencias nuevas.

## Contratos y recuperación

Sin cambios a contratos browser-pos-v1, orders-v3 ni loyalty-v1. Sin migraciones, borrado de datos ni nueva caché. Conserva eventos y validación del motor/servidor. Al cerrar cobro sin confirmar se conserva pedido; pagos editados no se reescriben automáticamente.

## Pruebas

### Extensión de pestañas (AC-016-08)

OrderTabs.tsx reemplaza el selector con una barra inferior desplazable, selección por teclado, cambio de nombre y cierre independiente. El motor deriva números estables del historial de pedidos del actor (incluidos cerrados) sin migración ni campos comerciales nuevos. El nombre usa el `label` existente mediante `order.save`; el botón visible y F2 abren un formulario accesible. Cerrar conserva la selección activa cuando el objetivo es otra pestaña. `order.cancel` ya admite `lines` vacío en los schemas v2/v3; el dominio lo acepta exclusivamente si el pedido también está vacío, conservando motivo, revisión, autorización e idempotencia. No se borra ningún pedido ni operación. El cierre vacío no pide confirmación; si la única venta aún es virtual, se guarda y cancela secuencialmente para que el cierre quede auditado, el número avance y aparezca una venta nueva. `+` también guarda la venta virtual antes de abrir una segunda pestaña. Pruebas de dominio, integración central y regresión de navegador sobre datos sintéticos.

Tests unitarios para búsqueda y resumen de pagos con efectivo/digital combinados, insuficiencia, exceso digital, entradas inválidas e importe exacto. E2E de UI y regresión de Caja, división, puntos, offline y reapertura existentes. Revisar capturas reales y axe, foco/teclado, scroll y visibilidad de cobro. Ejecutar typecheck, tests, integración y build. No acredita hardware ni despliegue.
