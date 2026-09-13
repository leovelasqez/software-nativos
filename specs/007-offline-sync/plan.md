# Plan técnico 007 — Incremento 0

Estado: verificado el alcance contractual y políticas del incremento 0. Misma autorización local registrada en plan 001.

## Incremento seleccionado

REQ-007-02/03/04/05: diseñar concesión offline y protocolo de operación/acuse. Validar dominio AC-007-03/06 y contrato parcial AC-007-02. Diseñar AC-007-01/02/04, sin afirmar persistencia ni sincronización implementadas.

## Diseño

Concesión por usuario/equipo/sucursal, instante de validación central y vencimiento máximo siete días exactos. Al expirar se permiten consulta, conservación de pedidos y cierre existente. Reloj regresivo impide nuevos cobros hasta validar online. Contrato exige firma central y almacenamiento protegido; núcleo recibe grant ya verificado por adaptador confiable. No aceptar un booleano de confianza enviado por HTTP.

Protocolo de entrega al menos una vez, efecto comercial idempotente mediante operación estable y contenido inmutable. Acuse siempre posterior al commit central. La función pura de transición de pendientes solo acepta acuse que coincide en identidad y hash. Ver [contrato](contracts/sync-v1.md) para transacciones, orden y errores.

## Contratos

`contracts/offline-grant-v1.schema.json`, `contracts/sync-v1.schema.json` y `contracts/sync-v1.md` junto a esta spec. La envoltura se define ahora; el payload tipado de venta y OpenAPI se completan en incremento 3 antes de cobros. Versión incompatible conserva pendiente para conciliación; nunca sobrescribe.

## Migración y recuperación

Sin SQLite/PostgreSQL aún. Futuro commit SQLite guarda venta/pagos/consumo/caja/outbox atómicamente. PostgreSQL aplica operación/recibo/efectos en un commit y restricción única. Fallo antes de commit revierte todo; después se recupera desde almacenamiento. Pruebas reales de reinicio y pérdida de respuesta pendientes de incremento 3. Sin promesa de recuperar disco perdido con operaciones no sincronizadas.

## Pruebas y operación

Fixtures sintéticas: plazo exacto, usuario/equipo/local diferentes, permisos revocados, retroceso de reloj, respuestas perdidas/reintentos como modelo puro, acuse incorrecto y conflicto. No se simula un servidor para presentarlo como integración real.

## Riesgos abiertos

DPAPI/firma, reloj tras reinicio, revocación real y reconexión serán pruebas de adaptadores en 1/3. Canje central queda fuera hasta DEC-007. Cálculo de ventas, reparto y tasas DEC-002/014 no bloquean envoltura, sí payload futuro.
