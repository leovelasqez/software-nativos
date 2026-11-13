# Correcciones del recorrido visual de Administración y Caja

Verificación local del 12 de noviembre de 2026 en Microsoft Edge con PostgreSQL y datos de prueba. Se reprodujeron los recorridos del informe a 390 × 844 y 1440 × 900 px, en temas claro y oscuro. También se comprobó el ancho de 320 px en Caja y Agentes. La tarea corresponde a TASK-017-09 y AC-017-07 a AC-017-09.

| Hallazgo | Comprobación en la aplicación |
| --- | --- |
| 01. Llegada a WhatsApp | Tras abrir el menú en Traslados y bajar 629 px, seleccionar WhatsApp con el teclado cerró el menú, devolvió el desplazamiento a 0 y enfocó el título. |
| 02. Campos vacíos | El borde de Documento en Nuevo cliente dio 3,72:1 en claro y 4,44:1 en oscuro frente al campo y al diálogo. El acceso a Caja usó los mismos pares de colores. Tab mostró el indicador de foco. |
| 03. Cabecera móvil | La franja midió 79 px tanto en Inventario como en Traslados. En Caja midió 72 px tanto en Venta como en Turno cerrado. |
| 04. Archivar y revocar | Ambas acciones muestran un icono de advertencia y un contorno diferenciado. Se archivó y restauró un producto de prueba y se abrió el formulario de revocación desde la conexión móvil. |
| 05. Requisitos de respaldos y compras | Con el destino sin configurar, Crear respaldo quedó deshabilitado junto al motivo. Con cero proveedores, Crear proveedor fue la acción principal. Guardar el primero habilitó Registrar compra y permitió seleccionarlo. |
| 06. Búsqueda y categorías de Caja | El campo de búsqueda ocupó 366 px y las acciones quedaron debajo. Se seleccionó la última de 23 categorías, se combinó con una referencia y se restableció el catálogo con Limpiar. |
| 07. Conexión y horarios | En móvil, título, párrafos, aviso y botón empezaron a 17 px del borde exterior de la tarjeta. También se comprobó su alineación en escritorio y en ambos temas. |
| 08. Acciones de tablas | A 390 px, la lista de agentes ocupó los 356 px disponibles, con ambos botones dentro de la pantalla. A 320 px tampoco hubo desplazamiento horizontal. Escritorio conservó las seis columnas. Los listados vacíos omitieron la tabla. |
| 09. Archivo Excel | El selector nativo recibió el foco y midió 42 px de alto con radio de 9 px. Debajo se leyó primero el estado vacío y luego un nombre de archivo largo completo, repartido en dos líneas. |
| 10. Tarjetas con nombres largos | A 1440 px, las filas del catálogo de prueba midieron entre 154 y 220 px. Las 23 tarjetas conservaron al menos 13 px desde el bloque del precio hasta el borde exterior, incluida «Copo de Semillas de Chía - Banano y Fresa». |
| L1. Cobro móvil | El pie pasó de los 308 px del informe a 146 px de un diálogo de 828 px. Se editó el importe y se comprobó el cambio calculado con el total y Confirmar cobro a la vista. |
| L2. Comandas | La línea sin opciones ni notas terminó en «Pendientes en pedido: 2» y tuvo cero saltos de línea. Una segunda línea con «Sin hielo» mostró la nota en su propio renglón. |

## Verificación del proyecto

- `npm run check` pasó la auditoría de 42 familias de estados, la comprobación de tipos, 85 pruebas unitarias, 92 de integración y la compilación del sitio con sus recursos offline.
