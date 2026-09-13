# Instrucciones para agentes — Software Nativos

## Fuente de verdad y estado

Lee [software-nativos.md](./software-nativos.md) antes de trabajar. Es la especificación consolidada del proyecto. Este archivo deriva de ese plan y no lo reemplaza.

## Flujo obligatorio de Spec Driven Development

Antes de implementar una capacidad, lee también [README.md](./README.md), [el proceso SDD](./docs/sdd.md), [la matriz de trazabilidad](./specs/README.md), la especificación afectada y sus decisiones abiertas. Para decisiones técnicas, consulta [arquitectura](./docs/architecture.md) y [decisiones pendientes](./docs/decisions.md).

- Orden de trabajo: requisito identificado → escenario de aceptación → diseño y contratos → tareas → código → pruebas y evidencia.
- No convertir propuestas, borradores o casillas marcadas por el propio agente en autorización del usuario. Una autorización existente para el alcance es suficiente; no pedir aprobación por cada tarea rutinaria.
- No implementar comportamientos con decisiones de negocio pendientes. Continuar con tareas independientes y consultar solo lo que bloquee el siguiente incremento.
- Antes de cambios productivos, completar `plan.md` y `tasks.md` junto al `spec.md` de la capacidad, usando las plantillas de `specs/_templates/`. Crear contratos de datos/API/sincronización cuando existan interfaces afectadas.
- Vincular tareas y pruebas con identificadores `REQ-NNN-NN` y `AC-NNN-NN`. Mantener especificación, contratos, implementación y evidencia alineados en el mismo cambio.
- Probar reglas de negocio en su dominio, persistencia y permisos en integración y los flujos críticos de usuario de extremo a extremo. No reducir la validación a revisar pantallas.
- Mantener el estado real de cada capacidad: consultar specs/README.md para el estado por alcance; no hay funcionalidad desplegada en producción.
- No introducir microservicios, colas externas o herramientas de generación por etiqueta metodológica. Justificar cambios arquitectónicos con una decisión registrada y evidencia.
- No es obligatorio instalar un framework SDD: el flujo inicial utiliza Markdown y, cuando se autorice implementar, contratos y pruebas versionados con el código.

La especificación detalla el plan de producto; no puede contradecirlo. Si se detecta una contradicción, documentarla y resolverla con la instrucción vigente del usuario antes de implementar la parte afectada.

La implementación local está autorizada por el usuario desde el 13-09-2026. Esta autorización sustituye el bloqueo anterior; no autoriza producción, contratación ni modificar Alegra. La creación de estos documentos y las revisiones de la maqueta no autorizan iniciar el sistema de producción, desplegarlo, contratar servicios ni modificar Alegra. Avanza dentro de esta autorización local sin solicitar de nuevo permisos ya concedidos.

Las instrucciones nuevas del usuario prevalecen. Si cambian el alcance, actualiza el plan y estas instrucciones cuando sea pertinente. No recuperes reglas descartadas de versiones anteriores.

## Contexto del negocio

- Nativos opera en Milán y Centro, con una caja por local.
- Administración web y caja Windows con operación offline de hasta siete días.
- Catálogo, precios y recetas compartidos; existencias por bodega y sucursal.
- Español, COP y America/Bogota.
- Maqueta actual: `C:\Users\pc\.codex\visualizations\2026\09\13\01a099a7-cd22-7ef0-8855-f075079607e8\nativos-interfaz.html`.

## Reglas que deben preservarse

1. **Producto Terminado** se compra listo para vender y descuenta unidades. **Producto Preparado** descuenta los ingredientes de su receta al cobrar.
2. Preparación/comanda no descuenta inventario. Cancelar algo ya preparado exige registrar desperdicio sin duplicar consumos.
3. Permitir venta con existencias negativas y alerta. No habilitar recetas incompletas ni inventar conversiones.
4. Todos los usuarios pueden crear productos, clientes y recetas online, aplicar descuentos y cancelar ventas antes de facturar sin aprobación de otro usuario.
5. Los productos se crean con formulario completo. Nombre, documento y celular son obligatorios para clientes nuevos. Conservar Consumidor final.
6. Los cambios de una línea de pedido afectan solo la venta actual. Mantener precio de catálogo e impuesto; los descuentos y opciones recalculan el importe.
7. Costos de recetas, costeo promedio y márgenes son exclusivos del dueño. El encargado sí registra y consulta los importes de compras de su local. Aplicar el alcance de esta excepción en servidor, API y exportaciones sin exponer costos al cajero.
8. Propina voluntaria y domicilio se presentan por separado; no generan puntos.
9. Fidelización inicial: 1 punto por $1.000 pagados en productos, valor $10 por punto, canje máximo 20%, sin vencimiento. Excluir descuentos, propina, envío y pagos con puntos de la base correspondiente.
10. Puntos offline quedan pendientes; canje solo online. No duplicar puntos al sincronizar o reimprimir ni otorgarlos por migraciones históricas.
11. Solo el dueño ajusta saldos y reglas de puntos. Todos pueden inscribir clientes online, consultar y canjear dentro de los límites.
12. Las devoluciones posteriores al cobro siguen sus permisos y trazabilidad. Cancelar antes del cobro no es borrar una venta facturada.
13. Conservar el verde `#00bf63`, la identidad Nativos, el menú lateral y el toggle claro/oscuro.
14. Propina porcentual sobre productos después de descuentos, antes del canje y sin envío; importe final al peso más cercano con precisión interna.
15. Cada cobro de cuenta dividida tiene cliente, comprobante y puntos propios. Revertir puntos de compras devueltas aunque produzca saldo negativo; bloquear canjes insuficientes, no compras.
16. Al cancelar o quitar unidades de una comanda, registrar cuántas ya se prepararon como desperdicio y cancelar las restantes sin consumo, sin aprobación de otro usuario.
17. Base de puntos: precios finales con impuestos, menos descuentos y canje. Límite de canje sobre productos después de descuentos y antes de canje. Devolver puntos utilizados y dinero pagado proporcionalmente a los productos devueltos; nunca convertir puntos en efectivo.
18. El cambio se entrega solo sobre efectivo; no aceptar excedentes digitales como cambio en efectivo.
19. Pasados siete días sin validación online, bloquear nuevos cobros y conservar consulta autorizada, pedidos guardados y cierre del turno, sin perder pendientes.
20. WhatsApp inicial: dueño y encargado del local; mínimos diariamente a las 8:00 a. m. de Colombia y cierre inmediato tras confirmación/sincronización. Configurar números reales antes de activar envíos.

## Organización e implementación propuesta

La base propuesta es React/TypeScript para web, Electron/SQLite para caja y Node.js/TypeScript/PostgreSQL para servidor. Inspecciona la implementación existente antes de crear estructuras nuevas; no asumas que la maqueta es una aplicación completa.

- Separar interfaz, reglas de negocio, persistencia y adaptadores de integración.
- Compartir cálculos y validaciones entre servidor y caja, con representación precisa de dinero y cantidades.
- Guardar venta, pagos, consumo y movimiento de caja de forma atómica.
- Utilizar identificadores de operación e idempotencia para sincronización, importaciones, puntos y notificaciones.
- Mantener versiones de recetas, precios y modificaciones aplicadas en cada operación histórica.
- Conservar pedidos y transacciones tras reinicios. Mostrar pendientes y última sincronización.
- No marcar registros locales como sincronizados antes del acuse central.
- No presentar datos remotos incompletos como información actual de todas las sucursales.
- No usar datos, tasas o cantidades ilustrativos de la maqueta como valores reales del negocio.

## Integraciones

### API y MCP

El MCP debe utilizar la API del sistema y sus validaciones. Implementar consultas, reportes, carga masiva de inventario y creación de productos con recetas. Identificar agentes, limitar permisos por sucursal y auditar operaciones. Nunca entregar acceso directo irrestricto a la base de datos.

### Excel

Exportar `.xlsx` con todos los resultados filtrados, no solo la página visible. Incluir contexto del reporte y respetar permisos. Un botón que simula descarga no cumple la función productiva.

### WhatsApp

Separar preparación del reporte, cola de envío y seguimiento de entrega. Alertas de mínimos agrupadas y cierre por turno después de sincronizar. No enviar mensajes reales durante pruebas de interfaz. Configurar emisor, destinatarios, plantillas y servicio antes de activar el envío autorizado.

### Alegra

Preservar identificadores externos y conciliar el historial desde el primer registro disponible. Migrar para consulta sin alterar inventario inicial, turnos nuevos ni puntos. No escribir en Alegra por inferencia a partir de la autorización para extraer datos.

## Archivos y datos

- Maestro: `..\Maestro_inventario_Nativos_2026.xlsx`.
- Formulaciones: `..\Formulaciones 2026.docx`.
- Referencia de catálogo/inventario: `..\Snapshot_Alegra_2026-09-03.xlsx`; no contiene el historial completo de ventas solicitado.
- Inventario inicial: conteo físico y costos revisados por local en la fecha de cambio.

Conservar los archivos fuente. No modificar originales, inventar datos faltantes ni incluir credenciales en código, Markdown, ejemplos o logs.

## Validación y entrega

Aplicar los casos de aceptación de la sección 16 del plan. Priorizar pruebas de recetas y sustituciones, descuentos/propina/puntos, división de cuenta, reinicios offline, idempotencia, permisos, exportación completa, notificaciones y restauración.

En cambios visuales, comprobar escritorio y móvil, temas claro/oscuro, teclado y formularios. Verificar interacciones y revisar capturas cuando corresponda. Mantener claramente separados los resultados de simulación y las funciones verificadas en producción.

Al entregar, indicar qué cambió, qué se verificó y cualquier limitación real. No afirmar que hubo cobros, descargas, envíos, migraciones o conexiones reales si solo se representaron en la maqueta.

## Pendientes y límites de alcance

Consultar la sección 17 del plan. No resolver por suposición la emisión fiscal, tasas, impresoras, conversiones, credenciales, destinatarios de WhatsApp o contratación. Estos pendientes no impiden el trabajo independiente expresamente autorizado.

No añadir por iniciativa propia producción por lotes, vencimientos, créditos, cuentas por pagar, contabilidad completa, tienda online, integración bancaria o recepción automática de domicilios.

No asumir que este archivo en minúsculas será descubierto automáticamente por todas las herramientas: cuando se delegue o se continúe en otro entorno, indicar expresamente que se deben leer `agents.md` y `software-nativos.md`.

## Aclaración de entorno y catálogo

Impuestos es opcional: permitir guardar y vender con el campo vacío, mostrando «Sin impuesto asignado», sin calcular impuesto ni inventar tasas. Conservar vacío distinto de tasa 0% o exención fiscal; los cambios no recalculan ventas anteriores. Se descarta el bloqueo propuesto por falta de impuesto. Milán usa T80A y Centro NP / New Print T82E, ambas USB de 80 mm, cada una compartida entre comprobantes y comandas. Validar controladores, impresión y cajones con hardware real. Solo hay un computador por local: no presentar copias en su mismo disco como protección ante pérdida total, ni respaldos centrales como cobertura de ventas sin sincronizar. El volumen real aún se desconoce; distinguir mediciones de cargas sintéticas.
