# Plan técnico — Migración y puesta en marcha, incremento 8

Estado: preparado; no autorizado para ejecutar sobre Alegra ni datos comerciales. Este plan convierte REQ-011-01 a REQ-011-05 y AC-011-01 a AC-011-07 en puertas verificables. No sustituye las decisiones pendientes ni autoriza producción, compras, contratación o envíos.

## Precondiciones que requieren intervención externa

| Puerta | Evidencia de entrada requerida | Dependencia |
| --- | --- | --- |
| MIG-01 | Exportación de solo lectura de Alegra, desde el primer documento disponible, con tipos, estados, identificadores, fechas, clientes, líneas, impuestos y pagos que permita el origen, conforme a `contracts/alegra-history-extract-v1.md` | DEC-011 y acceso del administrador |
| MIG-02 | Mapeo aprobado de sucursales, productos, clientes, impuestos y documentos no mapeables; una conversión sin fuente permanece rechazada | DEC-011, DEC-002 y fuente maestra |
| MIG-03 | Fecha/hora de corte, responsable y extracción final; no se importan ventas hechas entre ambas extracciones sin conciliarlas | Operación Nativos/Alegra |
| OPS-01 | Prueba representativa de inventario/costos aprobada; carga restante progresiva con datos revisados | Completada el 18-09-2026; DEC-005 no permite inferir costos |
| OPS-02 | Sin requisito: fiscalidad externa descartada para esta versión | DEC-009/GO-03 descartadas el 18-09-2026 |
| OPS-03 | Ensayos físicos por local: controladores, comprobante, comanda y apertura de cajón para T80A Milán y T82E Centro | DEC-008 |
| OPS-04 | Railway desplegado y PITR habilitado; faltan restauración aislada, retención aprobada, presupuesto, responsable, RPO y RTO | DEC-012 |
| OPS-05 | Autorización expresa de lanzamiento conjunto después de las conciliaciones y ensayos | Usuario/operación |

## Flujo seguro de migración

1. Copiar las fuentes a un área de preparación de solo lectura; registrar hash, nombre, fecha de extracción y cobertura declarada. No modificar los originales.
2. Validar estructura y elaborar un informe de filas/documentos no mapeables. Las conversiones, costos, sucursales o impuestos ausentes no reciben valores inventados.
3. Ejecutar la importación únicamente en una base aislada y con datos de prueba o copia autorizada. La clave externa debe hacer que el reintento sea idempotente.
4. Conciliar por período: conteo de documentos, estados, totales de productos/descuentos/pagos y lista explícita de omisiones. La historia importada es de consulta: no genera puntos, no modifica inventario inicial ni turnos posteriores.
5. Repetir con la extracción final hasta que el intervalo desde la primera extracción al corte esté cubierto sin duplicados. Preservar toda evidencia y no borrar la ejecución previa.
6. Registrar cada cantidad o costo inicial revisado como movimiento causal independiente de la historia. La carga puede ser progresiva; no usar ventas históricas para reconstruir existencias o costos ni convertir desconocidos en cero.
7. Antes del arranque conjunto, completar pruebas físicas y restauración aislada, documentando en especial que un pendiente exclusivo de IndexedDB no se recupera de un respaldo del servidor.
8. Solo con todas las puertas aprobadas, ejecutar el checklist de corte autorizado y la validación posterior de venta, caja e inventario por ambos locales.
9. Desplegar un único servicio web Railway conectado por red privada a PostgreSQL. Usar el dominio HTTPS generado, ejecutar migraciones al arrancar y verificar `/health`; no subir `.local`, archivos `.env`, evidencias ni datos comerciales locales.

## Invariantes y límites

- La importación no escribe en Alegra y no borra ni sustituye datos activos.
- Corregir una importación crea una ejecución nueva y conciliada; no se oculta ni reescribe la historia previa.
- Un fallo de impresión o cajón no puede repetir cobro ni consumo; se prueba por separado para comprobante y comanda.
- Las pruebas y restauraciones iniciales usan destinos aislados. Nunca se destruye un perfil comercial para validar AC-011-06.
- La fiscalidad externa queda fuera de esta versión y no es una puerta de lanzamiento. El adaptador WhatsApp permanece desactivado y la retención externa requiere los datos y autorizaciones definidos en OPS-04.

## Evidencia de salida

`docs/evidence/increment-8.md` debe conservar: manifiestos/hash de fuentes (sin secretos ni datos personales), mapeo y rechazos, resumen de cada conciliación, fecha de corte, cargas de inventario/costos revisadas, resultados de impresión/cajón por local, restauración aislada, responsables y autorización de lanzamiento. No incluir volcados comerciales, contraseñas, teléfonos ni credenciales.
