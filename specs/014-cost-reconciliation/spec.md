# 014 — Conciliación causal de costos

Estado: Verificada localmente. Autorización: respuesta 5A del usuario, 17-09-2026.

## Objetivo y alcance

Aplicar DEC-005 alternativa A: un artículo sin costo fiable conserva costo desconocido. El dueño puede registrar una conciliación causal, fechada y motivada para valoraciones futuras, sin modificar movimientos, ventas, comprobantes ni exportaciones históricas.

## Requisitos

- REQ-014-01: sólo el dueño con `cost.write` registra una conciliación por artículo y bodega con costo unitario, fecha efectiva y motivo.
- REQ-014-02: las conciliaciones forman un libro append-only; la vigente para consultas actuales es la más reciente por fecha efectiva y creación, con inicial vigente como antecedente cuando no existe conciliación.
- REQ-014-03: costo desconocido permanece `null`, nunca cero implícito; cajero y encargado no reciben conciliaciones, costos de receta ni margen.
- REQ-014-04: registrar una conciliación no recalcula ni modifica ventas, movimientos o informes exportados anteriormente.

## Aceptación

- AC-014-01 → REQ-014-01/02. Dado un artículo con costo pendiente, cuando el dueño concilia COP 2 por unidad base, entonces la consulta actual y el costo de receta lo usan, y el registro causal permanece consultable.
- AC-014-02 → REQ-014-01/03. Dado un encargado o cajero, cuando intenta leer o registrar conciliaciones, entonces recibe 403 y ningún costo se filtra.
- AC-014-03 → REQ-014-02/04. Dadas dos conciliaciones, cuando se consulta el libro, ambas permanecen; la nueva no altera movimientos ni comprobantes existentes.

## Dependencias

Extiende 003/008, DEC-005 y permisos de 001. El informe de margen histórico sigue pendiente hasta que cada salida tenga una valoración causal explícita; esta capacidad no inventa períodos contables ni recalcula historia.

## Evidencia

Verificada con contrato, migración 017, interfaz exclusiva del dueño y 15/15 pruebas PostgreSQL focalizadas. Evidencia: `docs/evidence/cost-reconciliation.md`.
