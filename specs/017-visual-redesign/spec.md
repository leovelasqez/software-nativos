# 017 — Identidad visual unificada y Resumen operativo

Estado: Implementado y verificado localmente el 19-09-2026. Autorización: «Aprobado Aplica esta propuesta visual a todo el sitio», después de revisar la maqueta de esta tarea. [Evidencia](../../docs/evidence/visual-redesign.md). Sin despliegue.

## Requisitos confirmados

- REQ-017-01: Administración, Caja, acceso, formularios y diálogos con Inter local, iconos lineales, fondo #f5f5f9, tarjetas blancas, texto #20212c, bordes suaves #e8e9f0 y verde #00bf63. Oscuro gris carbón #17181c, tarjetas #222329. Tema persistente, contraste y teclado.
- REQ-017-02: Resumen real con ventas del día/mes, ticket promedio, top 5 productos por unidades, gráfica mensual y alertas de inventario. Selector de sucursales autorizadas, incluida su combinación; última sincronización, carga/error/vacío sin cifras ficticias.
- REQ-017-03: Administración espaciosa, nombres y funciones conservados; distribución más clara y apariencia coherente en todos los módulos.
- REQ-017-04: Caja compacta, catálogo/pedido contiguos, listas desplazables y total/cobro siempre visibles a 1366×768 y 1024×768. Conservar flujos, permisos, datos, siete días offline y recuperación.
- REQ-017-05: móvil orientado a consultar ventas/inventario, con accesos directos y contenido legible a 390px y 320px. Conservar acceso a módulos mediante menú y permisos existentes; el uso móvil descrito no es una nueva prohibición de servidor.
- REQ-017-06: fuentes/iconos empaquetados, mismo origen y precarga offline. Comprobante térmico imprimible en blanco/negro.

## Aceptación

- AC-017-01 → REQ-017-01/03: revisar todos los módulos, acceso, diálogos representativos, temas, teclado y desbordamientos; comparar Resumen/Caja con la maqueta.
- AC-017-02 → REQ-017-02: PostgreSQL: alcance all/local, permisos, más de una página de ventas, límites día/mes Colombia, devoluciones, canje, propina/envío separados, ranking y mínimos. Sin costos ni datos de clientes en la respuesta.
- AC-017-03 → REQ-017-02/05: filtro actualiza todas las secciones; vacío/error/recarga; respuestas anteriores no sustituyen a la selección vigente; consulta móvil.
- AC-017-04 → REQ-017-04/06: total/cobro visibles con listas largas; regresión de Caja, división, pagos, puntos y offline/recarga/sincronización con fuentes locales.
- AC-017-05 → todos: typecheck, dominio, integración, build y E2E del proyecto; evidencia real y límites.

## Dependencias

001/003/004/005/006/008/012/015/016. Contrato: ../../contracts/dashboard-v1.md. Sin migraciones ni cambios al protocolo. La pantalla de 14 pulgadas no fija resolución: las dimensiones comprobadas son referencias técnicas. No publicar ni modificar Alegra en este alcance.
