# 013 — Ciclo de vida de catálogo

Estado: Verificada localmente. Autorización de implementación: el usuario confirmó el 17-09-2026 que los productos creados por error deben archivarse y que el cambio siga SDD.

## Objetivo y alcance

Permitir retirar de la operación productos de catálogo creados por error sin borrar sus versiones, movimientos, ventas ni auditoría. Afecta el catálogo compartido y el artículo de inventario automático de un Producto Terminado. No modifica recetas, saldos, comprobantes, precios históricos ni materias primas independientes.

## Requisitos

- REQ-013-01: un usuario con `product.create`, conectado y autorizado para una sucursal puede archivar o restaurar un producto mediante una operación idempotente, con motivo y control de versión.
- REQ-013-02: un producto archivado no aparece en las listas operativas de Productos, Caja ni Inventario; sus versiones e historia permanecen disponibles para auditoría y las ventas históricas no cambian.
- REQ-013-03: al archivar un Producto Terminado se archiva también su artículo de inventario automático, identificado por el mismo ID; no se archivan materias primas o consumibles independientes.
- REQ-013-04: archivar no elimina datos ni altera saldos. Los clientes Caja que ya conservaron un catálogo offline pueden requerir sincronización antes de dejar de mostrarlo; el servidor no reescribe comprobantes ni pedidos ya creados.

## Flujos y datos

El producto tiene estado activo o archivado. La transición de archivado guarda fecha; restaurar la elimina. Cada transición exige `branchId`, `operationId`, `reason` y `expectedVersion`, participa de la transacción de catálogo, conserva idempotencia y registra auditoría. Un conflicto de versión devuelve 409; producto inexistente devuelve 404; una transición repetida con la misma operación devuelve la respuesta original.

Las lecturas operativas omiten archivados de forma predeterminada. La Administración puede incluirlos explícitamente y ofrecer restauración. El inventario oculta el artículo automático archivado. Las versiones, movimientos y ventas históricas no se borran ni cambian.

## Aceptación

- AC-013-01 → REQ-013-01. Dado un Producto Terminado activo sin movimientos, cuando un cajero autorizado lo archiva con versión vigente, entonces la respuesta confirma el estado archivado, se registra auditoría y repetir la misma operación no genera otro efecto.
- AC-013-02 → REQ-013-02/03. Dado un producto archivado, cuando se consulta el catálogo, Caja e inventario operativos, entonces no se ofrece para venta ni aparece su artículo automático; al pedir explícitamente archivados, Administración lo muestra como archivado.
- AC-013-03 → REQ-013-01/02. Dado un producto archivado, cuando se restaura con una versión vigente, entonces vuelve a las listas operativas sin perder sus versiones previas.
- AC-013-04 → REQ-013-04. Dado un producto con historia, cuando se archiva, entonces versiones, movimientos y comprobantes permanecen consultables y ningún `DELETE` modifica el historial append-only.

## Dependencias y decisiones

Extiende 002 y su contrato de catálogo; conserva REQ-001-04 sobre auditoría y DEC-017 sobre versiones inmutables. No introduce un nuevo permiso: se reutiliza `product.create`, como edición de producto. La actualización de snapshots ya cacheados en Caja se aplica en la próxima sincronización; no se promete revocar un catálogo que un navegador mantenga offline.

## Evidencia

Verificada con contrato OpenAPI, migración 016, integración PostgreSQL y recorrido en Administración. Evidencia reproducible: `docs/evidence/catalog-lifecycle.md`.
