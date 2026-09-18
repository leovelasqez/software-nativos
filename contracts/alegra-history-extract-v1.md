# Contrato de preparación — extracción histórica de Alegra v1

Estado: solicitud de datos para MIG-01; no es una conexión, importador ni autorización para leer o escribir en Alegra. Vincula REQ-011-02/03 y AC-011-02/03.

## Entrega esperada

Una exportación de solo lectura desde el primer documento disponible hasta una fecha/hora declarada, acompañada de un manifiesto que indique cuenta/origen, zona horaria, fecha/hora de extracción, filtros, tipos de documento incluidos, conteos por tipo/estado y limitaciones conocidas. Conservar los archivos originales; no editar, completar ni normalizar valores manualmente en la fuente.

## Conjuntos mínimos

| Conjunto | Campos mínimos | Uso de conciliación |
| --- | --- | --- |
| Documentos | `externalDocumentId`, tipo, estado, fecha/hora, moneda, total, descuento, impuesto, propina/domicilio si el origen los separa, cliente externo opcional y sucursal/bodega externa si existe | Unicidad, período, estado y total por documento |
| Líneas | `externalDocumentId`, `externalLineId` si existe, producto externo, descripción, cantidad, unidad, precio, descuento, impuesto y total de línea | Conteos/cantidades y total de productos |
| Pagos | `externalDocumentId`, identificador de pago si existe, medio, importe, fecha/hora y estado | Conciliar total pagado por documento y medio |
| Clientes | ID externo, nombre/documento/contacto solo si la exportación autorizada lo permite | Preservar relación histórica sin crear duplicados por inferencia |
| Catálogo y sucursales | IDs externos, nombre, estado y referencia | Mapeo explícito o registro de no mapeado |

Los nombres de columnas pueden variar. El manifiesto de preparación debe declarar su correspondencia uno a uno y los campos ausentes. Un valor ausente permanece ausente; no se inventan impuestos, costos, sucursales, clientes ni conversiones.

## Reglas de preparación y seguridad

- Mantener `externalDocumentId` como clave de idempotencia. Si no existe, detener la importación y registrar la limitación para decisión explícita.
- Registrar por separado documentos anulados, borradores, notas, devoluciones y cualquier tipo no soportado; no convertirlos en ventas por suposición.
- La zona horaria del corte debe ser explícita y compatible con America/Bogota para la conciliación operativa.
- La historia importada es solo de consulta: no modifica existencias iniciales, turnos, Caja ni puntos.
- No incluir secretos, tokens, números completos de tarjetas, credenciales ni archivos de respaldo de Alegra en el repositorio o evidencia.

## Validaciones antes de importar

1. SHA-256, tamaño, fecha de extracción y cobertura se registran para cada archivo recibido.
2. No hay IDs de documento duplicados con datos distintos; los duplicados idénticos se reportan y el reintento no crea historia adicional.
3. Para cada período, la suma de líneas/pagos se compara con el total de documentos según la semántica que declare el origen; las diferencias se reportan, no se corrigen automáticamente.
4. Los documentos/líneas/clientes/productos/sucursales no mapeados quedan en un reporte de rechazo con su ID externo y motivo.
5. Una extracción final posterior al corte inicial cubre el intervalo completo sin omisiones ni duplicados.

## Resultado esperado de la preparación

El responsable entrega los archivos y un manifiesto de cobertura. Con ello se puede diseñar el mapeo y una importación aislada; no se habilita una importación comercial hasta que el mapeo, conciliación, corte y autorización estén aprobados.
