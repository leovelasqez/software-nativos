# 008 — Informes y exportaciones

Estado: implementación local parcial verificada; costos y márgenes pendientes de DEC-005. Fuente: plan, secciones 9 y 11.

## Requisitos

- REQ-008-01: consultar ventas por período/local/producto/cliente/medio, caja, movimientos, existencias/mínimos, compras, desperdicios y fidelización.
- REQ-008-02: costos, costo de ventas y margen bruto solo para dueño; separar gastos, propinas y domicilio; costo incierto produce margen pendiente.
- REQ-008-03: exportar `.xlsx` con todos los registros filtrados, no solo página visible, contexto de filtros/fecha y totales coherentes.
- REQ-008-04: aplicar permisos a consulta y descarga e indicar antigüedad de sincronización por sucursal.

## Fronteras

Definir filtros, semántica de fechas/turnos, inclusión de anulaciones y devoluciones, paginación, datos disponibles para cada rol y contrato de exportación. Reportes de gran volumen pueden requerir trabajo asíncrono; elegirlo por medición, no por defecto.

## Aceptación

- AC-008-01 → REQ-008-01/03. Dado un filtro que retorna 120 registros y una pantalla de 20, cuando se exporta, entonces el Excel contiene los 120 registros y sus totales, no únicamente los 20 visibles.
- AC-008-02 → REQ-008-02/04. Dado un cajero autorizado a consultar ventas, cuando cambia filtros o solicita descarga directamente, entonces el sistema conserva su alcance y no expone costos ni márgenes.
- AC-008-03 → REQ-008-01/04. Dado Centro sin sincronizar, cuando el dueño consulta ventas de ambos locales, entonces identifica claramente la última actualización de Centro.
- AC-008-04 → REQ-008-02/03. Dadas ventas con propinas y devoluciones, cuando se generan pantalla y Excel bajo los mismos filtros, entonces concilian sus totales y conceptos separados según el contrato aprobado.

## Dependencias y pendientes

001/003/004/005/006/007. DEC-005 afecta márgenes, DEC-012 volumen/retención. Evidencia: pendiente.

## Incremento 6 — alcance preparado

El incremento implementará las consultas y exportaciones que no dependan de costos, junto con la antigüedad de sincronización por sucursal. Costos, costo de ventas y margen permanecen pendientes de DEC-005; retención y estrategia de gran volumen permanecen sujetas a DEC-012. Ver `plan.md`, `tasks.md` y `../../contracts/reports-v1.md`.

- AC-008-05 → REQ-008-01/04. Con más de 100 productos, clientes o proveedores autorizados, los selectores permiten elegir registros de cualquier página; al cambiar de sede no quedan opciones de la anterior y la consulta/exportación conserva el filtro elegido.
