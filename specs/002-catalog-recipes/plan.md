# Plan técnico — Incremento 2

Estado: verificado en el alcance del incremento 2. Evidencia: ../../docs/evidence/increment-2.md. Autorización: «Continúa con el incremento 2 de nuestro sistema para Nativos», 14-09-2026.

## Incremento seleccionado
Alta y versionado de productos terminados/preparados, artículos de inventario, recetas borrador/activas, conversiones verificadas, existencias/mínimos por bodega y movimiento inicial con reversión relacionada. REQ-002-01 a 05 y REQ-003-01/02/05 parciales. Compras, traslados, conteos, costeo promedio con negativos y ventas quedan en incrementos 3/6. AC de cobro y conservación de pedido se verifican allí; no se simula un pedido en administración.

## Diseño
Módulo de dominio compartido con decimales exactos (BigInt, seis decimales); API Fastify y PostgreSQL existentes; React conserva shell/temas. Producto = presentación vendible con referencia única, tipo inmutable y versiones completas. Artículo base separado para terminado, materia prima o consumible. Unidad base inmutable. Recetas son versiones inmutables; nuevo borrador no retira la última activa. Activar valida todas las líneas/opciones y congela consumos base. Conversión por artículo documentada en cada línea, sin inferir densidad ni gotas. Solo conversiones métricas g/kg y ml/l universales. Sustitución identifica línea reemplazada y adicional agrega consumo/precio. Precio e impuesto se versionan; null distinto de 0/exento.

Mutaciones con lock transaccional compartido con identidad, reautenticación, permisos, identificador idempotente y auditoría en el mismo commit. Libro append-only, saldo derivado; inicial único vigente por artículo/bodega, corrección mediante reversión y nueva entrada. Costo inicial opcional exclusivo del dueño: desconocido conserva null; cálculo de receta solo si todos los costos de la bodega son conocidos. Sin estimar promedios ante negativos/entradas tardías (DEC-005).

## Contratos
contracts/catalog-inventory-v1.json (OpenAPI), complementado por contracts/catalog-inventory-v1.md. Errores 400/401/403/404/409. Todos los cambios incluyen operationId, reason y branchId. Lecturas limitadas/paginadas con cursor; costos en endpoint separado. Historia por versión estable para futuras ventas.

## Migración y recuperación
002 SQL aditiva y transaccional, no modifica 001 ni datos fuente. Migración repetible/checksum existente. Fallo de auditoría revierte todos los efectos; reintento devuelve respuesta guardada. Probar reinicio de BD y restauración mediante snapshot lógico de tablas e historial sintéticos a una base nueva, usando SQL; no equivale a respaldo operativo ni cobertura del disco perdido. Ningún cliente POS publicado requiere migración.

## Pruebas y operación
Dominio: exactitud, conversión faltante, adicionales/sustituciones y costo desconocido. Integración PostgreSQL/API: roles, alcance, idempotencia concurrente/conflicto, versiones, saldo y rollback. E2E: formularios, activar/borrador, inicial/reversión, persistencia, teclado, móvil y ambos temas con axe/capturas. Sin cambios en Alegra ni datos comerciales reales.

## Riesgos abiertos
Datos reales de cantidades/conversiones/precios/impuestos y conteo inicial pendientes de revisión. Se permiten registros manuales; no se precargan datos inventados. Costeo posterior condicionado a DEC-005.
