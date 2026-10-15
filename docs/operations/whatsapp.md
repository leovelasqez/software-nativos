# Reportes de WhatsApp para el dueño

Alcance confirmado 15-10-2026: emisor Business del negocio, destinatario único celular personal del dueño. Cada cierre sincronizado genera un aviso con cierre y consolidado de ventas del día de Centro/Milán; mínimos de ambos locales a las 08:00 Colombia. Sólo datos sincronizados. El mensaje indica parcial cuando hay turno abierto o falta cierre de la fecha; no puede conocer pendientes que aún existen únicamente en un navegador.

## Probar sin enviar

Abrir **WhatsApp** con usuario dueño autorizado a ambas sucursales. La pantalla informa conexión desactivada; consultar reportes, probar entrega/incertidumbre y descargar Excel. Las pruebas no cambian el estado de entrega ni crean intentos externos. **Evaluar mínimos ahora** crea una muestra manual por fecha siempre en modo preview, aunque el adaptador esté activo; nunca sustituye ni ocupa el corte automático. No reescribe una muestra ya preparada. Cada informe tiene un enlace autenticado estable y un Excel completo.

El programador registra el corte diario incluso si no hay faltantes. Ese corte vacío no se convierte más tarde en un aviso por una venta del mediodía. Si el servidor estuvo detenido a las 08:00, completa el corte al recuperar el servicio durante el mismo día. La confirmación de sincronización despierta el despachador después de responder, con la transacción comercial ya confirmada; el intervalo de un minuto sirve también como recuperación.

Un registro histórico es `legacy`; lo preparado sin configuración activa es `preview`. Ninguno se vuelve elegible al activar Meta posteriormente. No hay importación ni reenvío automático del historial. El estado de pendiente en modo prueba significa informe preparado, no un mensaje que saldrá luego.

## Configuración externa pendiente

Crear el portafolio empresarial de Nativos y la cuenta de WhatsApp Business Platform. El negocio ya tiene un número en la aplicación: comprobar elegibilidad y ruta de incorporación de **coexistencia** antes de registrar el número; conservar acceso habitual al celular. No desregistrar la aplicación para resolver un error ni prometer coexistencia antes de comprobarla. Fuentes oficiales: [conservar número y aplicación](https://whatsappbusiness.com/resources/resource-library/organize-whatsapp-inbox-meta-business-suite/), [integración directa o con proveedor](https://whatsappbusiness.com/products/business-platform/), [documentación Cloud API de Meta en Postman](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

La implementación usa Cloud API de Meta, con transporte fijado a graph.facebook.com; si la coexistencia requiere un proveedor, completar su alta y confirmar que entrega las credenciales de Cloud API correspondientes. Un proveedor con API propia requiere otro adaptador y no se configura como URL arbitraria.

Configurar secretos por entorno, exclusivamente en Railway. No copiar los de producción a staging. El despliegue de este incremento en staging conserva `NATIVOS_WHATSAPP_ENABLED=false`. La activación y cualquier mensaje real requieren una decisión operativa posterior del dueño.

| Variable | Uso |
| --- | --- |
| NATIVOS_WHATSAPP_ENABLED | `false` por defecto. `true` habilita sólo si todo está validado. |
| NATIVOS_WHATSAPP_GRAPH_VERSION | Versión vigente Graph explícita en formato vNN.0, comprobada al dar el alta. |
| NATIVOS_WHATSAPP_PHONE_NUMBER_ID | ID numérico del número emisor en Meta; no el teléfono. |
| NATIVOS_WHATSAPP_ACCESS_TOKEN | Token del sistema con permiso de mensajería; secreto. |
| NATIVOS_WHATSAPP_OWNER_PHONE | Celular personal receptor, formato internacional de 8–15 dígitos sin +. |
| NATIVOS_WHATSAPP_OWNER_USER_ID | ID del dueño humano activo con settings.manage/data.read y acceso a ambas sucursales. |
| NATIVOS_WHATSAPP_APP_SECRET | Secreto de la app Meta para autenticar HMAC del webhook. |
| NATIVOS_WHATSAPP_VERIFY_TOKEN | Valor aleatorio elegido para verificar el callback; secreto. |
| NATIVOS_WHATSAPP_CLOSE_TEMPLATE | Nombre aprobado de plantilla de cierre y consolidado. |
| NATIVOS_WHATSAPP_STOCK_TEMPLATE | Nombre aprobado de plantilla de mínimos. |
| NATIVOS_WHATSAPP_LANGUAGE | Idioma exactamente aprobado, por ejemplo es_CO si corresponde a la plantilla. |

No incluir valores reales en código, capturas, documentos, auditoría o exports. La pantalla informa variables faltantes y receptor enmascarado; no entrega token, números completos ni respuestas del proveedor. Configuración incompleta nunca realiza solicitudes externas.

## Contrato de las plantillas y webhook

Crear dos plantillas, cada una con texto fijo de Nativos, **un parámetro de cuerpo** para el resumen (una sola línea, máximo 900 caracteres) y **un botón URL** índice 0. El detalle enlazado y el Excel conservan toda la información aunque el resumen se abrevie. La categoría y el costo dependen de la aprobación de Meta; no afirmar una tarifa ni que el servicio sea gratuito. [Precios oficiales](https://whatsappbusiness.com/products/platform-pricing/).

Prefijo del botón de staging: `https://nativos-web-staging.up.railway.app/?notification={{1}}`. El adaptador sustituye sólo el ID de reporte. Para producción se requiere plantilla/origen propios verificados; nunca usar el enlace de otro entorno. Abrir el enlace sin sesión muestra login y después el mismo reporte; la API rechaza a cualquier usuario sin el alcance completo.

Callback de staging: `https://nativos-web-staging.up.railway.app/api/whatsapp/webhook`. Suscribir `messages`; verificar GET con verify token. POST requiere `X-Hub-Signature-256` válido del cuerpo crudo y phone_number_id configurado. No desactivar el control CSRF del resto de la aplicación. Probar en el entorno de Meta únicamente con destinatarios autorizados después de configurar la cuenta y obtener la autorización operativa.

## Estados y recuperación

HTTP 200 con wamid significa **aceptado**, no entregado. Confirmaciones firmadas progresan a enviado, entregado y leído. Eventos repetidos/fuera de orden no degradan entregas. El callback opaco correlaciona el intento incluso si llega antes de terminar la solicitud de envío.

Timeout, 5xx o respuesta sin ID: **incierto**, sin reenvío automático. Un proceso interrumpido en sending se recupera como incierto después de dos minutos. Sólo rechazo recuperable explícito (p. ej. cuota) habilita backoff: dos y cuatro minutos, máximo tres intentos totales. La próxima evaluación del proceso ocurre cada minuto. Un fallo definitivo o incierto se conserva visible y requiere revisar el servicio; no simular entrega como reconciliación. Un webhook firmado posterior puede confirmar el resultado.

Cambiar destinatario, dueño, emisor, versión o plantillas invalida para despacho las intenciones live preparadas con la configuración anterior. Rotar el access token no modifica el destino. Se comprueba actividad y alcance del dueño antes de cada despacho. No se promete entrega exactamente una vez frente a incertidumbre del proveedor.

Los libros de intentos y callbacks son append-only y se incluyen en el respaldo lógico/restauración aislada. Retención operativa definitiva y presupuesto quedan pendientes de la cuenta externa; este incremento no borra historia. Rollback: deshabilitar el adaptador, desplegar el artefacto anterior compatible con la migración aditiva y conservar nuevas tablas. No revertir migraciones ni eliminar intenciones para recuperar el servicio.
