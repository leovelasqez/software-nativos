# 021 — Estados y transiciones de la aplicación

Estado: verificado localmente. Autorización: solicitud del usuario del 09-11-2026 de encontrar las máquinas de estados implícitas y decidir mejoras de UX, DX y AX sin romper la aplicación.

Publicación solicitada posteriormente el 09-11-2026: «Haz el despliegue en railway». La entrega integra las correcciones de acceso ya publicadas desde `fix/caja-password-access` antes de desplegar en el servicio existente, primero staging y después producción. Conservar WhatsApp real desactivado y comprobar el entorno alojado mediante consultas públicas de salud, archivos y fronteras de autenticación.

## Objetivo y alcance

Inventariar las máquinas observables del árbol `software-nativos`, incluidas las representadas mediante booleanos, campos opcionales, libros de eventos y efectos asíncronos. Hacer explícitos los flujos con una mejora concreta y acotada. Preservar las reglas del plan, secciones 4–14, DEC-020/021/022, contratos públicos y datos offline.

## Requisitos

- REQ-021-01: publicar un mapa con estados, disparadores, guardas, persistencia, implementación y validación existente. Diferenciar máquinas ya explícitas, implícitas y adaptadores históricos; agrupar instancias equivalentes de interfaz.
- REQ-021-02: un formulario compartido acepta una sola ejecución en curso, incluso ante dos eventos de envío en el mismo turno de JavaScript. Un formulario deshabilitado no ejecuta su operación. Un error permite corregir y reintentar, conservando los campos.
- REQ-021-03: la importación Excel distingue edición, vista previa y confirmación persistida. Fallar la actualización de la lista después de confirmar conserva el éxito y permite reintentar solamente la consulta.
- REQ-021-04: centralizar estados y transiciones de entrega de notificaciones en un dominio puro y tipado, compartido por servidor y etiquetas web. Diferenciar resultados de transporte de callbacks, preservar entrega/lectura y no reintentar estados inciertos.
- REQ-021-05: el inventario es legible por personas y agentes y verificable contra los archivos del repositorio, sin nuevas dependencias, permisos ni endpoints.
- REQ-021-06: el manifiesto offline se genera con un orden canónico de recursos para que Windows y Linux produzcan el mismo artefacto verificable; conservar las rutas y la política de activación/cache existentes.

## Flujos y datos

Operación de formulario: `idle → running → succeeded | failed`; sólo `running` tiene una promesa activa, el bloqueo es sincrónico y el error pertenece al estado fallido. Importación: `editing → preview → completed`; el refresco es un subestado de `completed` y nunca revierte una confirmación central. Descargar/validar/confirmar comparten la exclusión de una operación local.

Notificaciones conservan los nueve estados SQL existentes. Los callbacks y respuestas pueden llegar en distinto orden: una respuesta HTTP no degrada un estado recibido por webhook; callbacks positivos progresan sin retroceder y `delivered/read` conservan la evidencia frente a fallos tardíos. Los reintentos siguen limitados a `pending/failed_retryable`, con la política actual de tres intentos.

## Aceptación

- AC-021-01 → REQ-021-01/05: el mapa cubre dominios, UI, offline, integraciones y compatibilidad; el comando de auditoría verifica IDs, estados, transiciones y referencias reales y devuelve JSON a petición.
- AC-021-02 → REQ-021-02: dos envíos concurrentes producen una sola llamada; error seguido de corrección permite otro intento; `disabled` impide enviar incluso por teclado/evento; `aria-busy` y el error reflejan el estado real. Prueba de dominio del controlador y navegador real.
- AC-021-03 → REQ-021-03: una confirmación correcta seguida de fallo de consulta muestra el lote guardado y una recuperación que no repite `/confirm`; editar archivo/motivo invalida la vista previa. Pruebas de transición y navegador con API sintética.
- AC-021-04 → REQ-021-04: callbacks repetidos/desordenados y respuesta posterior a fallo/entrega/lectura conservan el estado correcto; los estados aceptados por API y las etiquetas coinciden; integración con PostgreSQL y transporte sintético.
- AC-021-05 → todos: tipos, pruebas de dominio/integración, build y recorridos E2E conservan las regresiones actuales con datos sintéticos. Las comprobaciones alojadas de la publicación son de solo lectura.
- AC-021-06 → REQ-021-06: con nombres de recursos cuya enumeración difiere entre sistemas, el script real genera la lista en orden ordinal estable. La comparación de staging y producción exige la misma huella del service worker que el paquete local.

## Dependencias y decisiones

Reutilizar 009, 011, 012 y 019. La inspección no requiere cambiar decisiones de negocio. Se prefiere composición de máquinas pequeñas y funciones puras; introducir un framework global o reescribir persistencia aumentaría el riesgo sin beneficio verificado.

## Evidencia

AC-021-01 a 05 verificados con datos sintéticos: [evidencia y límites](../../docs/evidence/state-machines-2026-11-09.md). La [entrega combinada](../../docs/evidence/state-machines-publication-2026-11-09.md) conserva el acceso vigente de Caja: 92 pruebas de integración y cuatro recorridos Edge aprobados. AC-021-06 añade generación reproducible; tipos, las 85 pruebas unitarias y build pasan tras el ajuste. Los resultados alojados y el commit exacto se registran fuera de Git, como indica la evidencia de entrega. Diseño en [plan.md](plan.md), seguimiento en [tasks.md](tasks.md).
