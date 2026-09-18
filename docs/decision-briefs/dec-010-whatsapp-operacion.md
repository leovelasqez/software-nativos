# DEC-010 — Decisión requerida: operación de WhatsApp Business

Estado: propuesta operativa; no autoriza envíos ni contratación. Afecta REQ-009-01 a 04 y AC-009-04/05.

## Ya definido

- Resumen de mínimos: diariamente a las 08:00 de Colombia.
- Cierre: inmediatamente después de confirmación y sincronización.
- Destinatarios lógicos: dueño y encargado de cada sucursal.
- La aplicación ya guarda intenciones deduplicadas y estados locales, sin teléfono ni credenciales.

## Datos que debe suministrar/validar la operación

1. Proveedor elegido y cuenta de WhatsApp Business autorizada.
2. Número emisor y números destinatarios por rol/sucursal, con consentimiento y responsable de actualización.
3. Plantillas aprobadas para mínimo y cierre, incluyendo idioma, variables y enlace autenticado al informe.
4. Ambiente de prueba separado, secreto de acceso y responsable de rotación; nunca incluirlos en el repositorio, registros o payload comercial.
5. Presupuesto/costo, límite de envío y retención de los identificadores de proveedor.

## Política recomendada para entrega incierta

Cuando el proveedor responde timeout, 5xx o no entrega un identificador verificable, guardar `uncertain` y no reenviar automáticamente. El dueño revisa el estado en la cola y puede solicitar reconciliación por identificador de proveedor; sólo un resultado explícito `failed_retryable` habilita reintento. Esta política evita duplicar mensajes de cierre o alertas por un fallo de red.

## Activación segura

1. Configurar secretos fuera del repositorio y validar que no aparecen en auditoría, respaldo, API o exportación.
2. Ejecutar una plantilla de prueba con destinatarios aprobados en el ambiente de prueba.
3. Verificar que `delivered`, `retryable`, `terminal` y `uncertain` se reflejan en la cola sin afectar ventas, inventario ni cierre.
4. Probar la deduplicación de un mismo cierre y de un mínimo diario por sucursal.
5. Autorizar explícitamente el paso a producción; hasta entonces el adaptador permanece deshabilitado.

## Preguntas que requieren respuesta

- ¿Qué proveedor/cuenta/número emisor se usará?
- ¿Qué números concretos corresponden a dueño y encargado en Milán/Centro?
- ¿Quién confirma manualmente un estado incierto y en qué plazo?
- ¿Qué conservación se requiere para registros de entrega y errores?
