# Plan técnico de 020

Estado: Publicada y verificada en Railway el 14-10-2026. Decisiones comerciales confirmadas en spec.md.

## Diseño

Mantener usuario/actor y turno sin cambios. Agregar módulo de vendedores y versiones inmutables por edición, con API autenticada y administración exclusiva del dueño. Publicar en el catálogo de Caja solo los vendedores asignados a su sucursal, sin credenciales. Incluirlos en la identidad del snapshot para que cada cobro pueda referenciar una versión conservada centralmente.

Ampliar el dominio compartido y el contrato de cobro con referencia a snapshot/vendedor. El servidor reconstruye identidad y regla desde su snapshot, sin confiar en importes, nombres ni porcentajes enviados por el cliente. Conservar soporte para payloads anteriores y pendientes. Operación, venta, consumo y auditoría comparten la transacción existente. IndexedDB guarda selección y resultado con el mismo commit local.

Resumen por vendedor calculado desde ventas/devoluciones inmutables, con filtros de sucursal y fechas de Colombia. Detalle y Excel usan la misma proyección. Identidad de quien cobra se presenta por separado. Importes de dominio en BigInt/decimales, sin cálculo monetario en coma flotante.

## Contratos

contracts/sellers-v1.md y esquema de registro; ampliación aditiva de snapshot, nueva versión de eventos de venta y envoltura de sincronización. Validar entradas, referencias, versión optimista e idempotencia. Mantener permisos actuales de consulta por sucursal; no exponer configuración administrativa al cajero.

## Migración y recuperación

Agregar tablas de vendedores/versiones sin semillas de personas y sin reescribir pos_sales. Ventas antiguas se agrupan en «Sin vendedor registrado». Los clientes anteriores y sus colas siguen aceptados; snapshots nuevos permiten exigir la selección conforme a la decisión comercial sin bloquear la sincronización histórica. Renombrar/desactivar conserva las versiones anteriores para cobros pendientes. No borrar IndexedDB, perfiles, bases ni turnos para actualizar.

Si fuera necesario revertir la publicación, restaurar el artefacto anterior del mismo servicio, conservando las tablas aditivas y los datos ya registrados. No eliminar tablas ni revertir ventas para volver al cliente anterior; sus payloads y snapshots originales siguen admitidos. Cualquier vuelta posterior a esta capacidad conserva las versiones y atribuciones ya guardadas.

## Pruebas y publicación

Dominio: selección y versiones, devoluciones parciales y cálculo aprobado. PostgreSQL real: permisos, auditoría atómica, migración, sincronización y reintentos. Navegador/IndexedDB reales: misma sesión con dos vendedores, offline/recarga, cuenta dividida e informes/Excel, escritorio/móvil, temas y teclado. Ejecutar npm run check y suite E2E antes de publicar al servicio existente nativos-web/production. Salud y artefactos en producción solo lectura; no crear vendedores ni ventas comerciales para verificar.

## Decisiones y límites

Comisión fija por producto reducida en proporción al descuento, confirmada por el usuario; devoluciones revierten proporción acumulada de cantidad; redondeo por línea al peso, empate arriba. Las comisiones no configuradas se conservan pendientes, sin estimar cifras. Propinas netas al vendedor original; selección recordada por cuenta y caja. Las ventas anteriores no se recalculan al configurar valores nuevos.

La autorización negocia sellerSupport para conservar compatibilidad de clientes anteriores con esquemas cerrados. Nuevo payload v4 exige vendedor; colas v1/v2/v3 mantienen su contrato. Los respaldos agregan explícitamente vendedores y versiones de comisiones a la lista de tablas restaurables.

Cuentas compartidas identifican al vendedor declarado sin autenticarlo individualmente, conforme a la solicitud. Los nombres reales y valores de comisión se configuran por el dueño después de publicar; no crear personas ni tasas comerciales por inferencia.
