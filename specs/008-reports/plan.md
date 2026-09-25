# Plan técnico — Informes y exportaciones, incremento 6

Estado: implementación verificada excepto costos y márgenes bloqueados por DEC-005. Autorización local vigente desde el 13-09-2026.

## Incremento seleccionado

Consultas online de ventas, caja, inventario, compras, desperdicios y fidelización, con filtros explícitos por período y sucursal. La exportación entrega todos los resultados de la consulta autorizada, incluso cuando la interfaz pagina. Costos, costo de ventas y márgenes no se implementan ni exponen hasta resolver DEC-005.

## Diseño

El servidor construye una consulta por reporte y aplica autorización de sucursal antes de filtrar; el navegador no agrega filas ni calcula totales de seguridad. Las fechas se reciben como fechas locales inclusivas de Colombia y el servidor las convierte al intervalo `America/Bogota`; la respuesta declara el intervalo efectivo, filtros, totales y la última sincronización conocida por sucursal. Ventas anuladas y devoluciones se muestran como conceptos separados, sin alterar el comprobante histórico. Propina, domicilio, efectivo y medios digitales también se mantienen separados.

Las consultas se paginan con cursor estable solo para pantalla. La exportación no reutiliza esa página: reconstruye la misma consulta y autorización sin `limit`, con una guarda de volumen que se medirá antes de decidir trabajo asíncrono. El archivo es un `.xlsx` real, generado en servidor, con hoja de contexto, hoja de datos y hoja de totales; no se enviarán costos a roles que no pueden verlos.

## Contratos

`contracts/reports-v1.md` define filtros, columnas, semántica de devoluciones y respuesta. El contrato OpenAPI correspondiente separa `/api/reports/{kind}` de `/api/reports/{kind}/export`, fija `Content-Disposition` y prohíbe cachear los resultados. Los mismos parámetros producen los mismos totales bajo el mismo alcance de actor.

## Migración y recuperación

No duplica hechos comerciales: lee libros y comprobantes inmutables existentes. La exportación se genera bajo una instantánea de lectura para que datos y totales concilien. Un fallo no deja archivos comerciales persistentes en el servidor local.

## Pruebas y riesgos

Probar 120 filas con página de 20 y exportación completa; permisos de cajero; filtros de sucursal; separación de propina/domicilio/devolución; coincidencia pantalla-Excel; y aviso de antigüedad de sucursal. DEC-005 bloquea solo columnas de costo/margen; DEC-012 exige medir volumen y retención antes de optimizar o prometer escalabilidad.

## Correcciones de aceptación — 25-09-2026

NAT-UAT-03 / REQ-008-01/04: reutilizar la paginación completa del catálogo para productos, clientes y proveedores, conservar el alcance por sede y descartar respuestas de la sede anterior. Verificar catálogos mayores de 100 entradas y filtrado/exportación del producto que queda fuera de la primera página.
