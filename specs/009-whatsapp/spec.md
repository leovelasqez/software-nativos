# 009 — Notificaciones por WhatsApp

Estado: verificada localmente; publicación en staging en curso. Incremento de dueño autorizado el 15-10-2026: «arranca con la implementacion siguiendo la metodologia SDD y despliega en el entorno de pruebas que tenemos en railway». Publicación autorizada sólo en staging. La activación real depende de Meta, números y plantillas; no se envían mensajes durante las pruebas.

## Requisitos

- REQ-009-01: configurar destinatarios, frecuencia y agrupación de alertas por sucursal; integración mediante WhatsApp Business Platform.
- REQ-009-02: alertar al llegar o bajar del mínimo, con bodega/artículo/saldo/unidad/mínimo; evitar mensajes por cada venta repetida del mismo faltante.
- REQ-009-03: notificar cada cierre confirmado y sincronizado, con responsable, horario, ventas/medios, entradas/salidas/devoluciones, base, contado/esperado/diferencia y propinas/domicilios separados.
- REQ-009-04: procesar pendientes, errores y estados de entrega; incluir enlace autenticado al reporte completo y no bloquear ventas por fallas de mensajería.

## Estados y fronteras

Configuración vigente confirmada el 15-10-2026: destinatario único dueño, en su celular personal; emisor WhatsApp Business del negocio. No hay encargados por local. Mínimos de ambos locales a las 08:00 America/Bogota. Cada cierre confirmado y sincronizado genera un único mensaje que reúne cierre y consolidado de ventas de Centro y Milán del día del cierre; no espera al otro local. Si hay turnos abiertos o falta un cierre de la fecha, se identifica como parcial. Sólo se conocen hechos sincronizados; ninguna inferencia sobre pendientes ocultos en un navegador se presenta como certeza. No existe aún portafolio Meta; preservar la aplicación actual mediante coexistencia sujeta a elegibilidad.

Evento comercial confirmado → elegibilidad/agrupación → pendiente de envío → respuesta del proveedor → estado de entrega. Diferenciar rechazo, fallo recuperable y entrega incierta; no equiparar un timeout a «no enviado».

No hay envío real autorizado por la existencia de esta especificación. Emisor, plantillas, destinatarios y costo siguen pendientes de configurar y validar.

## Aceptación

- AC-009-01 → REQ-009-01/02. Dado un faltante ya incluido en el aviso del período, cuando se realizan más ventas del mismo artículo, entonces se respeta la regla de agrupación y no se emite un aviso por venta.
- AC-009-02 → REQ-009-02. Dado un corte con ventas y una reposición posterior, cuando se sincronizan los movimientos, entonces se evalúa el saldo actualizado antes de decidir si avisar.
- AC-009-03 → REQ-009-03/04. Dado un cierre cuya sincronización se repite, cuando se procesa, entonces se mantiene una sola intención de notificación ligada al cierre.
- AC-009-04 → REQ-009-04. Dado el proveedor inaccesible o una respuesta incierta, cuando se intenta notificar, entonces venta/cierre siguen confirmados, el estado es visible y se aplica la política de recuperación sin reenvíos ciegos.

- AC-009-05 → REQ-009-01/02/03. Dada la configuración vigente, cuando son las 08:00 de Colombia o el servidor recupera ese corte más tarde en el mismo día, se genera un único resumen de mínimos de ambas sucursales exclusivamente para el dueño; un cierre genera su propio consolidado sin esperar al siguiente día.

## Incremento de dueño — requisitos y aceptación

- REQ-009-05: consolidado inmutable por fecha colombiana al confirmar cada cierre, con sucursales, ventas netas de devoluciones, cantidad de ventas, medios netos, propinas/domicilios netos y última sincronización. El cierre usa el cálculo compartido del comprobante, incluidas correcciones.
- REQ-009-06: vista previa, detalle autenticado por ID, Excel completo y paginación estable; sólo dueño con acceso a todas las sucursales incluidas. El enlace conserva su destino después del login. No exponer secretos ni teléfonos completos.
- REQ-009-07: adaptador Cloud API desactivado por defecto; sólo intenciones nuevas creadas con configuración activa son elegibles. Aceptación HTTP del proveedor no significa entrega. Webhook HMAC firmado, eventos idempotentes y fuera de orden, recuperación de solicitudes interrumpidas como inciertas, reintentos limitados sólo ante rechazo recuperable explícito. Nunca realizar llamadas externas dentro de una transacción comercial.
- REQ-009-08: las simulaciones no alteran el estado real ni generan intentos de proveedor. Las intenciones históricas y de prueba nunca se convierten automáticamente en mensajes reales. Configuración de secretos exclusivamente mediante variables de entorno.

- AC-009-06 → REQ-009-05: dado un cierre Centro y Milán abierto, se guarda un único consolidado parcial del día; al cerrar Milán se crea otra instantánea actualizada; repetir el mismo cierre no crea otra. Dominio/integración PostgreSQL.
- AC-009-07 → REQ-009-03/05: dadas devoluciones y un retiro corregido, resumen y comprobante coinciden en propinas, domicilios, medios, correcciones y efectivo. Se conservan datos anteriores a medianoche en la fecha correcta. Dominio/integración.
- AC-009-08 → REQ-009-06/08: vista previa y Excel contienen el informe completo, paginan sin perder registros y rechazan cajero/dueño de otra sucursal; simular no cambia estado ni habilita envío. Navegador e integración.
- AC-009-09 → REQ-009-07: con adaptador deshabilitado o configuración incompleta no hay red; 200 con ID queda aceptado; webhook firmado confirma entrega; firma inválida no escribe; timeout y reinicio conservan incertidumbre sin reenvío ciego. Prueba con transporte sintético, sin Meta real.
- AC-009-10 → REQ-009-07/08: intentos concurrentes toman una sola intención; respuesta perdida no duplica envío; webhooks repetidos/fuera de orden no degradan entrega; autorización revocada impide despacho. Integración.
- AC-009-11 → REQ-009-06: pantalla WhatsApp en escritorio/móvil, ambos temas, teclado, detalle por enlace después de login, filtros y descarga; salud y fronteras verificadas en Railway staging. Producción sin cambios.

## Dependencias y pendientes

003/006/007/008. El incremento de dueño usa `plan.md`, tareas y contrato v2. DEC-010 mantiene pendiente el alta de cuenta, elegibilidad de coexistencia, números, plantillas, presupuesto y retención. Estas decisiones no bloquean la implementación desactivada ni el despliegue en staging autorizado. El transporte y callbacks se verifican con datos sintéticos; no acreditan entrega real de Meta.
