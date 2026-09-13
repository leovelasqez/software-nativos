# 011 — Migración y puesta en marcha

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, secciones 14–17.

## Requisitos

- REQ-011-01: importar catálogo desde el maestro y contrastar formulaciones; resolver conversiones y datos activos sin alterar los originales.
- REQ-011-02: recuperar todo el historial de ventas disponible en Alegra desde el primer registro; preservar identificadores, estados y datos disponibles y conciliar documentos/totales.
- REQ-011-03: historia de consulta sin descontar existencias iniciales, afectar turnos nuevos ni generar puntos; inventario inicial por conteo físico y costos revisados por local.
- REQ-011-04: probar hardware, recuperación de respaldos, esquema local y procedimientos operativos; definir qué datos no sincronizados no están cubiertos por respaldo central.
- REQ-011-05: ensayar y lanzar conjuntamente Milán/Centro después de validación, definición fiscal y preparación operativa; no incluir funciones excluidas en el plan por inferencia.

## Fronteras

Extracción de solo lectura → archivo/área de preparación → mapeo y validación → importación repetible → conciliación → corte operativo. Registrar filas/documentos sin mapear y ausencias históricas; no inventar costos ni sucursales.

Definir una fecha de corte y actualización final para evitar omitir ventas realizadas en Alegra entre una extracción inicial y el cambio. El procedimiento de recuperación debe conservar lo nuevo si se requiere corregir una importación o volver temporalmente al sistema anterior.

## Aceptación

- AC-011-01 → REQ-011-01. Dada una conversión no resuelta en el maestro, cuando se importa, entonces se reporta y no se activa una receta incorrecta.
- AC-011-02 → REQ-011-02/03. Dado un historial importado y conciliado, cuando se repite la importación, entonces se conservan documentos únicos y no varían inventario inicial, turnos nuevos ni puntos.
- AC-011-03 → REQ-011-02. Dada una extracción con documentos posteriores a la primera carga, cuando se ejecuta el corte final, entonces la conciliación cubre todo el período sin omisiones ni duplicados.
- AC-011-04 → REQ-011-04. Dado un respaldo y operaciones locales pendientes, cuando se ensaya una restauración, entonces se demuestra qué datos se recuperan, qué pendientes sobreviven y los límites reales del procedimiento.
- AC-011-05 → REQ-011-05. Dadas las pruebas de ambos locales y pendientes de puesta en marcha resueltos, cuando se autoriza el cambio, entonces se ejecuta el procedimiento conjunto y se registra la validación de ventas/caja/inventario posterior.

## Dependencias y pendientes

Todas las capacidades que integren la primera versión; DEC-008/009/011/012. No marcar hardware, fiscalidad, entrega de mensajes o recuperación como verificados por pruebas de maqueta. Evidencia: pendiente.

## Entorno confirmado y validación pendiente

Asignación confirmada por el usuario y nuevas fotos aportadas el 13 de septiembre de 2026 (sustituyen la identificación provisional anterior):

- Milán: T80A, papel de 80 mm, USB y ESC/POS indicados en la etiqueta (nueva Foto 2); marca no identificada.
- Centro: NP / New Print T82E, USB y 80 mm (nueva Foto 1). No inferir soporte ESC/POS de esta unidad.
- Cada local usa su misma impresora para comprobantes y comandas.
- Pendientes: controladores, prueba de impresión y apertura del cajón.
- Cada local tiene solo su computador, sin respaldo offline en otro dispositivo. El volumen diario y de hora pico no está disponible; obtener mediciones del historial y piloto antes de cerrar el dimensionamiento.

AC-011-06 → REQ-011-04. Dada una pérdida total simulada del almacenamiento local, cuando se ensaya recuperación desde el servidor, entonces se concilian las operaciones previamente sincronizadas y se documenta que las operaciones exclusivamente locales no están cubiertas. Una copia en el mismo disco no se contabiliza como recuperación frente a este fallo. No realizar esta prueba destruyendo datos reales.

- AC-011-07 → REQ-011-04. Dadas la T80A USB de Milán y la T82E USB de Centro, cuando se ensayan comprobantes y comandas online y offline en cada local, entonces ambos documentos se dirigen a la misma impresora de ese local, con formato de 80 mm. Una falla de impresión no repite cobros; la comanda no descuenta inventario. Registrar evidencia por equipo y probar la apertura del cajón por separado.
