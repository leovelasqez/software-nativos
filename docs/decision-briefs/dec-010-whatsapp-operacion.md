# DEC-010 — Decisión requerida: operación de WhatsApp Business

Estado: implementación y publicación en staging autorizadas el 15-10-2026. Alta Meta y envíos reales pendientes. Afecta REQ-009-01 a 08 y AC-009-04 a 11. Configuración y recuperación vigentes en [guía operativa](../operations/whatsapp.md).

## Ya definido

- Resumen de mínimos: diariamente a las 08:00 de Colombia.
- Cierre más consolidado de ventas del día de Centro/Milán: inmediatamente después de cada confirmación y sincronización. Un único mensaje por cierre, parcial mientras falte el cierre de otro local.
- Destinatario único: celular personal del dueño. No hay encargados. Emisor: número de WhatsApp Business del negocio, preservando aplicación mediante coexistencia si es elegible.
- La aplicación ya guarda intenciones deduplicadas y estados locales, sin teléfono ni credenciales.

## Datos que debe suministrar/validar la operación

1. Proveedor elegido y cuenta de WhatsApp Business autorizada.
2. Número emisor comercial y número personal receptor del dueño; no destinatarios por sucursal.
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

- El adaptador usa Cloud API de Meta; falta crear portafolio/cuenta y confirmar la incorporación del número existente mediante coexistencia.
- Faltan los valores del emisor y receptor personal; configurar por entorno sin incluirlos en el repositorio.
- ¿Quién confirma manualmente un estado incierto y en qué plazo?
- ¿Qué conservación se requiere para registros de entrega y errores?
