# Prevuelo — Incremento 8 local

Fecha: 17-09-2026. Alcance: inventario de fuentes locales en modo solo lectura para REQ-011-01/02. No acredita importación, conciliación, acceso a Alegra, conteo físico, prueba de hardware ni lanzamiento.

## Línea base de archivos

| Archivo | Tamaño | SHA-256 | Cobertura observada |
| --- | ---: | --- | --- |
| `Maestro_inventario_Nativos_2026.xlsx` | 161.156 bytes | `7199cf122c6f277b5977570ec2197f3e3c07adea5e4f614c42d52376576a6f7c` | Maestro de materias primas, recetas/kits, terminados, conversiones, plan de carga y facturas de insumos. |
| `Snapshot_Alegra_2026-09-03.xlsx` | 65.673 bytes | `abfebf6c5d3ec2dc6cc939a2330c0df2910c92cf1858ccaa73dc73d9e6ae2aa8` | Resumen, productos, componentes KIT e inventario por bodega. No contiene una exportación del historial de ventas. |
| `inventario.xlsx` | 10.119 bytes | `3eb4bfd534722d55fc7dd227bf3ed1054bd789f8fb49e4b678a67542ba02d2f4` | Hoja de inventario de referencia; no está designada como fuente oficial de migración. |

## Estructura revisada

| Fuente | Hoja | Fila de encabezados | Filas no vacías observadas | Campos de preparación relevantes |
| --- | --- | ---: | ---: | --- |
| Maestro | Materias primas | 5 | 121 | Código, nombre normalizado, unidad base, categoría y revisión. |
| Maestro | Recetas-Kits | 5 | 1.374 | Producto, ingrediente, cantidad/unidad fuente y base, revisión y referencia DOCX. |
| Maestro | Productos terminados | 5 | 239 | ID, producto, categoría, tamaño, tipo, estado y observaciones. |
| Maestro | Conversiones-Revisión | 5 | 189 | Producto, ingrediente, equivalencia, estado y notas. |
| Maestro | Plan Alegra | 5 | 355 | Entidad, ID, nombre, acción, bodega y estado. |
| Maestro | Facturas insumos | 5 | 26 | Factura, proveedor, cantidad, unidad, precio/costo y validación. |
| Snapshot Alegra | Productos creados | 4 | 240 | ID, referencia, estado, precio, unidad, existencia y bodega. |
| Snapshot Alegra | Componentes KIT | 4 | 736 | KIT, componente, cantidad, unidad y disponibilidad. |
| Snapshot Alegra | Inventario por bodega | 4 | 73 | Producto, bodega, cantidad inicial, disponible y unidad. |

## Resultado y siguiente entrada

Las fuentes locales permiten preparar catálogo, recetas, conversiones e inventario, conservando las conversiones sin resolver como rechazos. No permiten cumplir REQ-011-02 ni AC-011-03: falta una exportación de solo lectura de Alegra desde el primer documento disponible, incluidos identificadores, estados, fechas, clientes, líneas, impuestos y pagos que exponga el origen. Esa exportación activa MIG-01; hasta entonces no se importa información comercial ni se estima historial.
