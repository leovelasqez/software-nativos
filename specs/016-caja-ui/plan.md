# Plan técnico de 016

Estado: Verificada localmente. Alcance completo de spec.md autorizado en esta tarea.

## Diseño

Pos.tsx organiza una cabecera operativa, catálogo filtrable y pedido. pos.css limita el desplazamiento a las listas en escritorio y conserva resumen inferior móvil. Menú móvil desplegable con controles accesibles. Metadatos editables desde la cabecera del pedido. Detalles técnicos en details.

OrderForms.tsx conserva formulario y dominio: división y fidelización se expanden explícitamente; pie de cobro visible con cálculo vivo. Helpers puros en web/pos-ui.ts normalizan búsqueda y calculan resumen de pago exacto reutilizando catálogo/orders-domain, sin persistir valores derivados. No dependencias nuevas.

## Contratos y recuperación

Sin cambios a contratos browser-pos-v1, orders-v3 ni loyalty-v1. Sin migraciones, borrado de datos ni nueva caché. Conserva eventos y validación del motor/servidor. Al cerrar cobro sin confirmar se conserva pedido; pagos editados no se reescriben automáticamente.

## Pruebas

Tests unitarios para búsqueda y resumen de pagos con efectivo/digital combinados, insuficiencia, exceso digital, entradas inválidas e importe exacto. E2E de UI y regresión de Caja, división, puntos, offline y reapertura existentes. Revisar capturas reales y axe, foco/teclado, scroll y visibilidad de cobro. Ejecutar typecheck, tests, integración y build. No acredita hardware ni despliegue.
