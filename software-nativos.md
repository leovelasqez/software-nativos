# Software Nativos — Plan funcional y técnico

Última actualización: 13 de septiembre de 2026.

Metodología de desarrollo: **Spec Driven Development (SDD)**. Este archivo conserva el alcance funcional del producto. La ruta de trabajo, especificaciones, trazabilidad y decisiones técnicas se organizan desde [README.md](./README.md). La adopción de SDD no cambia las reglas acordadas ni equivale a aprobar la implementación.

## 1. Estado y objetivo

Este documento consolida el plan y las modificaciones acordadas con el usuario. La implementación local está autorizada desde el mensaje del usuario del 13-09-2026; no se autoriza desplegar en producción, contratar servicios ni modificar Alegra. Se ha elaborado una maqueta interactiva con datos de ejemplo; sus controles y simulaciones no constituyen funciones de producción.

El objetivo es reemplazar Alegra para controlar ventas, inventario, ingresos, salidas, caja, clientes, proveedores, recetas, fidelización, usuarios, roles, informes y auditoría. El sistema tendrá administración web online y una aplicación de caja para Windows que pueda continuar operando sin internet.

Operación inicial:

- Dos sucursales: Milán y Centro.
- Una caja por local, entre 6 y 10 usuarios y aproximadamente 150 productos comerciales, con sus presentaciones.
- Equipos Windows 10 y 11, impresoras térmicas de 80 mm y cajón monedero. Sin lector de códigos inicialmente.
- Capacidad para crear más sucursales y bodegas.
- Catálogo, precios y recetas compartidos entre sucursales.
- Una bodega predeterminada de venta por sucursal; las demás la abastecen mediante traslados.
- Puesta en marcha conjunta en ambos locales después de completar pruebas y conciliaciones.
- Moneda: pesos colombianos. Zona horaria: America/Bogota. Interfaz en español.

## 2. Diseño visual

- Tomar la paleta de Alegra como referencia, sustituyendo su verde principal por `#00bf63`.
- Mantener la identidad de Nativos y la navegación lateral por módulos.
- Incluir un interruptor visible de modo claro/oscuro. Conservar el modo elegido al navegar entre módulos y aplicar el tema a formularios, tablas, comprobantes y ventanas emergentes.
- Mantener contraste legible, navegación por teclado y adaptación a pantallas pequeñas.
- La caja tendrá búsqueda rápida, botones cómodos y un pedido con totales y acciones claramente visibles.
- Las simulaciones de desconexión y avisos de datos de ejemplo pertenecen a la maqueta, no al flujo operativo del producto final.

Maqueta vigente:

`C:\Users\pc\.codex\visualizations\2026\09\13\01a099a7-cd22-7ef0-8855-f075079607e8\nativos-interfaz.html`

## 3. Módulos

Resumen, Ventas, Productos e Inventario, Recetas, Compras y Proveedores, Caja e Ingresos/Salidas, Clientes, Fidelización, Informes, WhatsApp, Agentes de IA, Sucursales y Bodegas, Usuarios y Roles, Auditoría y Configuración. Los grupos de navegación pueden reunir funciones relacionadas sin eliminar capacidades del plan.

## 4. Ventas

### Atención y pedido

- Atender mostrador, mesas, pedidos abiertos y domicilios registrados manualmente.
- Conservar pedidos antes de cobrar y permitir dividir cuentas por productos.
- Cada cobro de una cuenta dividida tendrá su cliente, comprobante y acumulación de puntos por los productos pagados en ese cobro.
- Imprimir comandas con presentación, cantidades, adicionales, sustituciones y notas.
- El envío a preparación no descuenta inventario: el descuento se realiza al cobrar.
- En cuentas divididas, descontar exclusivamente los productos cobrados, una sola vez.
- Los pagos aceptados son efectivo, tarjeta, transferencia, Bre-B, Daviplata y Nequi. Permitir combinar medios de pago.
- Registrar pagos manualmente; no incluir inicialmente integración bancaria ni validación automática de transferencias.
- Entregar cambio únicamente sobre la parte pagada en efectivo. Los medios digitales no pueden registrar excedentes para convertirlos en cambio en efectivo.
- Los precios del menú son finales. Utilizar las tasas tributarias que proporcione el usuario, sin inventarlas a partir de los ejemplos de la maqueta.

### Crear productos desde ventas

- Incluir el botón **+ Nuevo producto**, disponible para todos los usuarios únicamente online.
- Abrir un formulario completo desde el inicio, basado en el flujo documentado de Alegra y adaptado a Nativos.
- Tipos disponibles:
  - **Producto Terminado:** llega del proveedor listo para vender y descuenta unidades del artículo.
  - **Producto Preparado:** se elabora en el local y descuenta los ingredientes de su receta al cobrar.
- Campos: nombre, referencia, categoría, unidad, presentación, precio final, impuestos y descripción; costo unitario accesible únicamente al dueño.
- Los impuestos se asignarán a cada producto después de crearlo. El campo es opcional y puede quedar en blanco al guardar y vender. Mostrar «Sin impuesto asignado», sin tasa por defecto ni cálculo de impuesto para ese producto. Conservar el valor vacío, distinto de una tasa explícita del 0% o de una clasificación fiscal de exento. Asignaciones posteriores aplican a ventas nuevas y no recalculan ventas anteriores.
- Para preparados, incluir receta, ingredientes, cantidades, unidades, empaques, adicionales y sustituciones.
- Habilitar preparados para vender solo cuando la receta y sus conversiones estén completas.
- Crear el producto no debe borrar, cobrar ni reiniciar el pedido actual. Las existencias iniciales se registran por bodega mediante movimientos de inventario.
- Para usuarios distintos del dueño, no exponer costos ni permitir su edición. Un costo desconocido queda pendiente, no se trata como costo cero.

### Cliente de la venta

- Incluir un desplegable con búsqueda por nombre, documento o celular y la opción **Consumidor final**.
- Añadir el botón **+ Nuevo cliente**, disponible para todos los usuarios online.
- Nombre, documento y celular obligatorios; correo y dirección opcionales.
- Guardar y seleccionar el nuevo cliente sin perder el pedido. Evitar registros duplicados por documento.
- Sin conexión, permitir seleccionar clientes previamente sincronizados; la creación de clientes requiere internet.

### Editar y eliminar productos

- Cada línea tendrá botones **Editar** y **Eliminar**.
- Permitir cambiar cantidad, presentación, adicionales, sustituciones y notas.
- Todos los usuarios podrán aplicar descuentos sin autorización de otro usuario, por porcentaje o valor. El descuento no puede exceder el importe de la línea.
- Mantener el precio de catálogo y el impuesto configurado; recalcular el importe de la venta a través del descuento y las opciones seleccionadas.
- Los cambios aplican exclusivamente al pedido actual, sin modificar el catálogo ni la receta general.
- Recalcular inmediatamente totales y consumo previsto de ingredientes.
- Registrar cambios de pedidos ya enviados a preparación y distinguir productos recuperables de los ya preparados.

### Cancelar antes de facturar

- Incluir el botón **Cancelar venta** para todos los usuarios, sin aprobación de otro usuario.
- Pedir confirmación para evitar cancelaciones accidentales. Confirmar la acción no equivale a exigir autorización de un encargado.
- Si el pedido ya se envió a preparación, registrar motivo y qué productos se prepararon para contabilizar el desperdicio correspondiente.
- Al cancelar o quitar unidades enviadas, el cajero indicará cuántas ya se prepararon: esas unidades generan desperdicio; las restantes se cancelan sin consumo. No requiere aprobación de otro usuario.
- Registrar eliminaciones y cancelaciones en auditoría.
- Después de facturar, utilizar el flujo de devolución autorizado; no borrar la venta original.

### Propina y comprobante

- Incluir propina voluntaria como valor o porcentaje antes de cobrar.
- La propina porcentual se calcula sobre los productos después de descuentos y antes del canje de puntos, sin incluir domicilio.
- Redondear el importe final al peso más cercano, conservando precisión interna. La distribución de redondeos e impuestos entre líneas se concretará en el contrato de cálculo.
- Mostrarla separada de productos, descuentos e impuestos, en pedido, comprobante, cierre y reportes.
- Separar también los cobros de domicilio de los ingresos por productos.
- La propina y los domicilios no generan puntos.
- Emitir inicialmente comprobantes internos, con numeración única por sucursal y caja, independiente de internet.
- Para clientes inscritos, mostrar los puntos de la compra y el saldo disponible. Offline: puntos pendientes de sincronización y último saldo conocido, claramente identificados.

## 5. Inventario, compras y proveedores

- Distinguir materias primas, productos preparados, productos terminados y empaques/consumibles.
- Registrar compras pagadas, proveedor, productos, cantidades, costos y forma de pago. No incluir cuentas por pagar inicialmente.
- El encargado registra la compra completa de su local, incluidos precios de compra y valor pagado. Puede consultar esos importes dentro de compras; esta excepción no habilita reportes de costos de recetas ni márgenes.
- Convertir compras por empaque a unidades base: por ejemplo, una bolsa de pulpa de 1 kg se convierte en 1.000 g.
- Controlar cantidades y mínimos por artículo y bodega, sin lotes ni vencimientos en la primera versión.
- Registrar traslados con despacho y recepción, conteos físicos, ajustes con motivo, desperdicios, daños y consumo interno.
- Permitir ventas con inventario negativo, mostrando una alerta.
- Calcular costo promedio ponderado por artículo y bodega. Identificar márgenes pendientes cuando no exista un costo fiable.
- En devoluciones, reingresar únicamente artículos recuperables. Lo preparado o no recuperable se registra como pérdida, evitando duplicar el consumo ya contabilizado.
- Las compras, traslados y cambios administrativos de inventario requieren conexión.

## 6. Recetas

- Incluir el botón **+ Nueva receta** y un formulario completo, disponibles online para todos los usuarios.
- Campos: nombre, Producto Preparado asociado, presentación, ingredientes, cantidades, unidades, empaques, adicionales, sustituciones e instrucciones opcionales.
- Permitir agregar, editar y eliminar ingredientes y guardar borradores.
- Activar solo recetas con cantidades y conversiones completas; un borrador no habilita el producto para vender.
- Calcular el costo de la receta y mostrarlo exclusivamente al dueño.
- Mantener recetas por presentación y compartirlas entre locales.
- Descontar la materia prima efectivamente seleccionada: una sustitución reemplaza el consumo del ingrediente original; un adicional agrega su consumo y precio.
- Versionar recetas. Guardar la versión y las modificaciones utilizadas en cada venta para no alterar operaciones anteriores.
- No implementar producción por lotes en esta primera versión.

## 7. Caja, ingresos y salidas

- Apertura con base, un responsable por turno y un único turno activo por caja.
- Registrar ventas, entradas, gastos, retiros y devoluciones; distinguir movimientos de efectivo de otros medios de pago.
- Cerrar mediante conteo, efectivo esperado, efectivo contado y diferencias.
- Separar propinas y cobros de domicilio.
- Mantener pedidos, turno y movimientos al reiniciar Windows sin internet.
- Enviar el resumen de cierre por WhatsApp después de confirmar y sincronizar el turno.

## 8. Clientes y domicilios

- Registro único de cliente con identidad, contacto, historial de compras y direcciones.
- Inscripción opcional a fidelización vinculada al cliente existente.
- Domicilios ingresados manualmente a partir de pedidos recibidos por teléfono, WhatsApp u otros medios externos.
- Registrar dirección, costo de envío, repartidor y estado del pedido.
- No incluir inicialmente tienda online, recepción automática desde WhatsApp ni integraciones con plataformas de domicilios.

## 9. Fidelización

Módulo independiente en el menú principal.

- Buscar, inscribir y consultar clientes del programa sin crear duplicados.
- Mostrar saldo, puntos pendientes e historial de acumulación, canjes, devoluciones y ajustes, vinculados a las ventas.
- Regla inicial: **1 punto por cada $1.000 pagados en productos** después de descuentos, excluyendo propinas, envío y montos pagados con puntos.
- Regla inicial: **cada punto vale $10** y el canje puede cubrir hasta el **20% del valor de los productos**.
- La base de acumulación usa precios finales con impuestos incluidos, después de descuentos y de restar lo pagado con puntos. El límite de canje del 20% usa el valor de productos con impuestos después de descuentos, antes del propio canje, sin propina ni envío.
- Al devolver una compra pagada parcialmente con puntos, restituir los puntos usados y devolver únicamente el dinero efectivamente pagado, proporcionalmente a los productos devueltos. No convertir puntos en efectivo. También se revierten los puntos generados por esos productos, según la regla de saldo negativo acordada.
- Por defecto, acumular puntos enteros por compra, redondeando hacia abajo. Inicialmente no vencen.
- Agregar automáticamente los puntos al confirmar el cobro del cliente inscrito.
- Canjear desde ventas solo online, verificando el saldo central para impedir doble uso entre sucursales.
- Las ventas offline generan puntos pendientes, que se confirman al sincronizar. No presentar un saldo desactualizado como disponible en tiempo real.
- No duplicar puntos por reintentos, sincronización o reimpresión. Ajustar puntos por devoluciones relacionadas con la compra original.
- Si al revertir puntos de una compra devuelta el cliente ya los gastó, permitir saldo negativo y bloquear nuevos canjes hasta disponer de saldo suficiente; no bloquear compras. La asignación exacta para devoluciones parciales se especificará en el contrato.
- No otorgar puntos retroactivos por el historial migrado desde Alegra.
- Todos los usuarios pueden inscribir clientes, consultar puntos y aplicar canjes. La inscripción requiere conexión.
- Solo el dueño puede ajustar saldos manualmente o cambiar equivalencias, límite de canje y vencimiento; registrar motivo y auditoría.
- Cambiar reglas no debe recalcular compras pasadas.
- Exportar a Excel clientes inscritos, puntos acumulados, canjeados y saldos.

## 10. Roles y auditoría

| Función | Dueño | Encargado | Cajero |
| --- | --- | --- | --- |
| Vender, editar pedidos y cobrar | Sí | Sí | Sí |
| Aplicar descuentos | Sí | Sí | Sí |
| Eliminar líneas y cancelar antes de facturar | Sí | Sí | Sí |
| Crear productos, recetas y clientes online | Sí | Sí | Sí |
| Inscribir clientes y aplicar canjes | Sí | Sí | Sí |
| Compras y control administrativo de inventario | Sí | Su local | No por defecto |
| Registrar y consultar importes de compras | Sí | Su local | No |
| Autorizar devoluciones posteriores al cobro | Sí | Su local | No por defecto |
| Consultar o editar costos y ver márgenes | Sí | No | No |
| Ajustar puntos o reglas de fidelización | Sí | No | No |
| Configurar usuarios, agentes e integraciones | Sí | No por defecto | No por defecto |

Los perfiles serán configurables y limitables por sucursal. Las restricciones de costos deben aplicarse en la API y los datos entregados al cliente, no solamente ocultando controles. La captura y consulta de importes de compras por el encargado es una excepción explícita; no le concede acceso al costo de recetas, costeo promedio ni márgenes.

Auditar usuario o agente, sucursal, equipo, fecha, motivo y cambios realizados. Conservar trazabilidad de ventas, recetas, inventario, descuentos, cancelaciones, devoluciones, puntos, importaciones y configuraciones. Corregir operaciones confirmadas con movimientos relacionados; no borrarlas ni sobrescribir su historia.

Las reglas anteriores sustituyen expresamente la propuesta inicial que exigía autorización para descuentos y cancelaciones previas al cobro.

## 11. Informes y exportación a Excel

- Ventas por fecha, sucursal, producto, cliente y medio de pago.
- Caja, turnos, ingresos, salidas y diferencias de cierre.
- Existencias, mínimos, movimientos, compras y desperdicios por bodega.
- Costos de recetas, costo de ventas y margen bruto, visibles solo al dueño; gastos operativos separados. No equivale a contabilidad completa.
- Fidelización y movimientos de puntos.
- Botón **Descargar Excel (.xlsx)** en los reportes correspondientes.
- Exportar todos los registros que cumplen los filtros, no solo la página visible.
- Incluir período, sucursal/bodega, fecha de generación, detalle y totales pertinentes.
- Aplicar los mismos permisos al reporte en pantalla y al archivo exportado.
- Mostrar la fecha de última sincronización cuando falten datos de alguna sucursal.

## 12. Reportes por WhatsApp

Utilizar una integración de WhatsApp Business Platform. El número emisor, destinatarios, plantillas y costos del servicio se configurarán antes de activar envíos reales.

### Inventario en mínimos

- Avisar cuando el saldo alcance o quede por debajo del mínimo configurado.
- Incluir sucursal, bodega, artículo, cantidad disponible, unidad y mínimo.
- Permitir configurar destinatarios, frecuencia y agrupación de avisos.
- Configuración inicial acordada: resumen diario de inventario bajo a las 8:00 a. m., hora de Colombia, dirigido al dueño y al encargado del local. Los números concretos están pendientes de configurar.
- Evitar enviar un mensaje repetido por cada venta del mismo artículo.
- Si hubo desconexión, evaluar el saldo actualizado después de sincronizar antes de enviar la alerta.

### Cierre de turno

- Enviar automáticamente al confirmar y sincronizar el cierre.
- Destinatarios iniciales: dueño y encargado del local. Enviar inmediatamente después de que el cierre quede confirmado y sincronizado, sujeto a disponibilidad del servicio.
- Incluir sucursal, cajero, horario, ventas, medios de pago, base, entradas, salidas, devoluciones, efectivo esperado, contado y diferencia.
- Mostrar propinas y domicilios separados.
- Incluir un enlace autenticado al reporte completo con descarga en Excel.
- Conservar envíos pendientes durante desconexiones; registrar estados y errores y evitar duplicados por reintentos.

## 13. API y MCP para agentes de IA

Crear una API documentada y un servidor MCP que utilice esa misma API, con permisos por agente y sucursal, para agentes como Codex.

Capacidades iniciales:

- Consultar productos, recetas, existencias y movimientos.
- Consultar ventas y generar reportes descargables.
- Cargar inventario masivamente por bodega.
- Crear productos con presentaciones, ingredientes, cantidades y recetas.

Condiciones:

- Usar identidades y credenciales revocables por agente; no incorporar secretos en código, documentos o registros visibles.
- Reutilizar las validaciones y reglas del sistema; no dar acceso directo irrestricto a la base de datos.
- Validar cargas con vista previa y errores por fila, distinguiendo inventario inicial, entradas y ajustes.
- Usar identificadores de operación para que reintentos no dupliquen productos, existencias ni reportes.
- Auditar consultas y cambios según su naturaleza, preservando la identidad del agente.
- Consultar datos sincronizados e indicar sucursales con información pendiente.
- Respetar las restricciones de costos y demás permisos del agente.

## 14. Arquitectura técnica propuesta

La siguiente es la base técnica propuesta, no una implementación ya realizada:

- Administración web: React y TypeScript.
- Caja Windows: Electron y SQLite local.
- Servidor: API Node.js/TypeScript y PostgreSQL central.
- Compartir reglas de cálculo entre caja y servidor.
- API autenticada para administración, sincronización e importaciones. MCP como adaptador de la misma API.
- Operaciones de venta con dinero y cantidades representados de forma precisa, sin depender de errores de coma flotante.
- Registrar cobro, consumo y movimiento de caja en una misma transacción local antes de confirmar al usuario.
- Sincronización con operaciones únicas, reintentos y confirmación central; no eliminar pendientes sin acuse de recibo.
- Conservar precios y versiones de recetas aplicados durante la desconexión.
- Cola de impresión y reimpresión identificada como copia; una falla de impresión no repite el cobro.
- Respaldos locales y centrales, con restauraciones probadas. El servidor solo puede respaldar operaciones ya sincronizadas.
- Cada local dispone únicamente de su computador, sin otro equipo ni disco externo para respaldo offline. Las copias en el mismo disco ayudan ante ciertos errores lógicos, pero no protegen contra pérdida total del equipo o disco. Las operaciones aún no sincronizadas podrían perderse en ese caso; no prometer pérdida cero. Diseñar sincronización automática al reconectar y recuperación con alcance explícito.
- Alojamiento propuesto: servicio administrado en Render con aplicación y PostgreSQL de pago. La configuración y el costo definitivo se cotizarán antes de contratar.

### Operación offline

- Hasta siete días desde la última validación online para usuarios previamente autorizados en el equipo.
- Al agotar los siete días sin validación online, bloquear nuevos cobros hasta reconectar; conservar consulta de datos autorizados, pedidos guardados y cierre del turno existente. No borrar ni perder operaciones pendientes.
- Vender, seleccionar clientes sincronizados, editar pedidos, aplicar descuentos, registrar propinas, cancelar y manejar turnos de caja.
- Recuperar pedidos y transacciones tras cerrar la aplicación o reiniciar Windows.
- Acumular puntos pendientes; no canjear offline.
- Crear productos, recetas y clientes requiere conexión. También requieren conexión las compras, traslados y cambios administrativos.
- Las revocaciones y cambios de permisos remotos se reciben al reconectar.
- Los reportes centrales identificarán datos pendientes y última sincronización por local.

## 15. Importación y cambio de sistema

- Fuente oficial del catálogo: `..\Maestro_inventario_Nativos_2026.xlsx`, contrastado con `..\Formulaciones 2026.docx`.
- Revisar ingredientes, productos activos, presentaciones, conversiones pendientes, sustituciones y sus precios antes de importar.
- El archivo `..\Snapshot_Alegra_2026-09-03.xlsx` contiene catálogo e inventario; no reemplaza la extracción del historial de ventas.
- Recuperar de Alegra todas las ventas disponibles desde el primer registro. El usuario cuenta con acceso de administrador; utilizar una conexión segura y verificar cobertura de todos los documentos usados.
- Conservar identificadores externos, fechas, estados, productos, clientes, impuestos y pagos disponibles.
- Migrar el historial para consulta sin descontar el inventario actual, modificar turnos nuevos ni generar puntos retroactivos.
- No inventar costos, sucursales u otros datos históricos ausentes.
- Conciliar cantidades de documentos y totales por período contra Alegra.
- Cargar cantidades y costos iniciales mediante conteo físico por local en la fecha de cambio.
- Realizar ensayos en Milán y Centro antes de la puesta en marcha conjunta.

## 16. Pruebas de aceptación

1. Venta de batido de 12 onzas: descontar exactamente su receta; repetir con adicionales y sustituciones.
2. Venta de Producto Terminado: descontar unidades, sin consumo de receta.
3. Crear productos, clientes y recetas sin perder el pedido; impedir activar preparados incompletos y proteger costos por rol.
4. Editar cantidades, eliminar líneas, descontar por porcentaje/valor y cancelar sin aprobación; registrar desperdicios cuando corresponda.
5. Dividir cuentas y combinar pagos sin duplicar ventas, impuestos, consumo ni puntos.
6. Propina por valor/porcentaje: total correcto y exclusión de la base de puntos.
7. Fidelización: acumulación automática, límite de canje, comprobante, devoluciones y canjes simultáneos entre locales.
8. Simular siete días offline, reinicios y reconexiones interrumpidas sin perder ni duplicar transacciones; impedir creación online durante el corte.
9. Impresión de 80 mm, comandas, reimpresión y apertura del cajón en equipos reales.
10. Cierre por cajero, efectivo esperado/contado, diferencias y separación de propinas y domicilios.
11. Exportar a Excel todos los resultados filtrados, con totales correctos y permisos aplicados.
12. Probar API/MCP: permisos, validaciones de recetas, cargas con errores y reintentos sin duplicados.
13. WhatsApp: alertas agrupadas, cierres offline pendientes, reintentos, estados y ausencia de duplicados.
14. Restaurar respaldos y conciliar la migración completa con Alegra.
15. Modo claro/oscuro, contraste, teclado, formularios y navegación en escritorio y pantallas pequeñas.

## 17. Pendientes y límites

Pendientes antes de operar:

- Implementación local autorizada el 13-09-2026; puesta en producción y contratación siguen fuera de esta autorización.
- Confirmadas dos impresoras USB de 80 mm: Milán usa T80A (etiqueta indica ESC/POS) y Centro usa NP / New Print T82E. Cada local imprime comprobantes y comandas en su misma impresora. Pendiente compatibilidad real con Windows, controladores y cajones; las fotos no sustituyen la prueba física.
- Definición fiscal con el contador: la primera versión emite comprobantes internos; falta resolver cómo emitir los documentos fiscales aplicables al reemplazar Alegra.
- Tasas tributarias concretas, conversiones de recetas, productos activos, precios de adicionales y sustituciones.
- Acceso seguro a Alegra y validación del alcance real del historial extraíble.
- Números del emisor y destinatarios de WhatsApp, plantillas y costo. Frecuencia y destinatarios por rol ya definidos: mínimos a las 8:00 a. m. y cierres al sincronizar para dueño y encargado del local.
- Contratación de alojamiento, dominio si se desea y política operativa de respaldos.

Fuera de la primera versión: producción por lotes, lotes/vencimientos, ventas a crédito, cuentas por pagar, contabilidad completa, tienda online, integraciones bancarias y recepción automática de domicilios. La emisión electrónica requiere definición adicional; no se presenta como implementada ni resuelta.

No se ha fijado una fecha límite de lanzamiento ni un presupuesto mensual aprobado.

## 18. Referencias revisadas

- [Crear productos en Alegra POS](https://ayuda.alegra.com/int/crea-y-gestiona-tus-productos-desde-el-sistema-punto-de-venta-pos).
- [Editar productos durante una venta](https://ayuda.alegra.com/int/edita-tus-productos-mientras-vendes-pos).
- [Clientes en Alegra POS Colombia](https://ayuda.alegra.com/col/gestiona-tus-contactos-en-pos).
- [Consulta de facturas en la API de Alegra](https://developer.alegra.com/reference/get_invoices).
- [Respaldos PostgreSQL de Render](https://render.com/docs/postgresql-backups).
- [Precios de Render](https://render.com/pricing).

Las decisiones explícitas de Nativos tienen prioridad sobre el comportamiento de referencia de Alegra. Los formularios se adaptan a los tipos de productos y permisos acordados, sin copiar reglas ajenas al negocio.

## Aclaración de entorno — 13 de septiembre de 2026

El volumen diario y por hora pico todavía se desconoce. Medirlo con el historial disponible y el piloto; los escenarios sintéticos de rendimiento deberán identificarse como objetivos de prueba, nunca como ventas reales. La configuración tributaria se completará por producto después de su creación. Ver [registro de decisiones](./docs/decisions.md), aclaración SDD 3.
