# Validación operativa con el personal de Nativos

Fecha de preparación: 25-09-2026. Estado: **plan con ejecución posterior en navegador; hay fallos y cobertura parcial**. Consultar [resultados reales y evidencias del 25-09-2026](../evidence/validacion-navegador-2026-09-25.md). Los criterios de este documento son el alcance previsto; no todos quedaron aprobados.

Objetivo: comprobar que el personal puede completar su jornada y que cada operación concilia entre Caja, inventario, clientes y Administración. Una pantalla que abre o un botón que responde no bastan para aprobar un flujo.

## Participantes y preparación

El usuario confirmó estos cinco roles: caja, preparación, encargado de sede, inventario y dueño. Son funciones del personal; los perfiles de acceso documentados del software son cajero, encargado y dueño. Preparación puede participar mediante la comanda impresa; no se presupone una pantalla de cocina ni perfiles independientes para preparación e inventario. Para inventario, usar una cuenta con permisos de encargado limitada a su sede, o los permisos explícitamente configurados por el dueño.

| Participante | Necesidad que debe validar | Participación |
| --- | --- | --- |
| Caja | Atender, recuperar pedidos y cobrar sin perder información | Ejecuta la venta y el cierre con su propia cuenta |
| Preparación | Entender cantidades, presentación, cambios y notas sin aclaraciones evitables | Lee comandas y confirma qué se preparó o desperdició |
| Encargado de sede | Resolver devoluciones, compras, diferencias y pendientes de su local | Ejecuta excepciones y revisa el cierre |
| Inventario | Explicar cada entrada y salida y comparar lo físico con el sistema | Verifica recetas, compras, traslados y conteos |
| Dueño | Comparar ambas sedes y controlar permisos, costos y recuperación | Revisa informes, auditoría y condiciones de lanzamiento |

Preparar un entorno aislado y la versión candidata a lanzamiento. Registrar versión/commit o identificador de compilación, fecha, sede, navegador y operador. La copia de trabajo revisada tiene cambios locales, incluida importación Excel: la aceptación debe repetirse sobre la compilación que realmente se vaya a publicar.

Usar cuentas de prueba por rol y sede, clientes ficticios y productos de ensayo identificables. Repetir los recorridos de caja y hardware en Milán y Centro. Primera activación y descarga de catálogo con internet; conservar el mismo origen y perfil de navegador durante cada ensayo offline. No borrar datos del sitio como solución a un fallo.

Estos escenarios no requieren modificar Alegra, emitir mensajes reales ni hacer cobros bancarios. Los pagos son registros de ensayo; Nativos no verifica automáticamente transferencias.

## Datos reproducibles de ensayo

Son cifras sintéticas, no precios, recetas, costos ni existencias reales de Nativos. Crear esta configuración exclusivamente en el entorno de pruebas. Antes de cada caso numérico, restablecer su estado mediante una base de ensayo preparada o usar artículos independientes; no mezclar saldos de casos distintos.

| Dato | Configuración |
| --- | --- |
| Terminado T | Precio final $5.000; existencia inicial 10 unidades |
| Preparado B de 12 oz | Precio final $10.000; receta de prueba: 100 g de pulpa P, 200 ml de líquido L y 1 vaso V |
| Existencias para B | P: 1.000 g; L: 2.000 ml; V: 10 unidades |
| Sustitución | Reemplazar 200 ml de L por 200 ml de L2; recargo sintético $2.000; L2 inicial: 1.000 ml |
| Adicional | 20 g de ingrediente A; recargo $1.000; A inicial: 200 g |
| Impuesto | Sin asignar; no confundir con tasa cero ni inventar una tasa |
| Clientes | Dos clientes ficticios inscritos; uno con 500 puntos para el caso de canje |
| Fidelización | Regla inicial documentada: 1 punto/$1.000 elegibles, $10/punto, máximo 20%, puntos enteros hacia abajo |
| Base de caja | $150.000 para el caso de cierre aislado |

## Flujos de caja y preparación

### F01. Comenzar la jornada en la sede correcta

**Ejecutan:** cajero y encargado. **Módulos:** acceso, Caja → Turno.

1. El dueño activa previamente el navegador de ensayo; el cajero entra con su cuenta y comprueba la sede.
2. Abre turno con base de $150.000 y registra el responsable.
3. Navega a Administración y vuelve a Caja; recarga la página.
4. Otra cuenta intenta abrir un segundo turno de esa misma caja.

**Debe ocurrir:** se conservan sesión, sede y turno; existe un único turno comercial activo y el segundo intento se rechaza de forma comprensible. Un usuario no opera como si fuera responsable del turno ajeno.

**Evidencia:** ID del turno, responsable, base, sede y rechazo del segundo intento. **Trazabilidad:** REQ-006-01; AC-006-01; AC-012-01; AC-018-04.

### F02. Venta rápida de un producto terminado

**Ejecuta:** cajero; inventario verifica después. **Módulos:** Caja → Venta, Comprobantes; Inventario.

1. Selecciona Consumidor final, agrega 2 unidades de T y cobra $10.000.
2. Registra $20.000 recibidos en efectivo y entrega $10.000 de cambio.
3. Consulta y reimprime el comprobante; sincroniza y vuelve a consultarlo en Administración.

**Debe ocurrir:** existencia de T de 10 a 8; entrada neta de efectivo $10.000; una venta, un comprobante y un consumo. Reimprimir no repite ninguno. El impuesto permanece sin asignar y Consumidor final no recibe puntos de un cliente inscrito.

**Evidencia:** comprobante y saldos antes/después, local y central. **Trazabilidad:** REQ-004-05; AC-004-05/10/11; REQ-003-03.

### F03. Preparado con sustitución, adicional y nota

**Ejecutan:** cajero, preparación e inventario. **Módulos:** Caja → Venta/Comandas; Recetas; Inventario.

1. Agrega B, sustituye L por L2, añade A y escribe una nota de preparación de prueba.
2. Envía la comanda. Preparación debe identificar presentación, cantidades, sustitución, adicional y nota.
3. Comprueba que enviar/imprimir no movió existencias. Cobra los $13.000.

**Debe ocurrir:** después del cobro quedan P: 900 g, L: 2.000 ml, L2: 800 ml, V: 9 y A: 180 g. La sustitución no consume L. La receta y los precios generales no cambian por editar este pedido.

**Evidencia:** comanda leída por preparación, comprobante y movimientos por ingrediente. **Trazabilidad:** REQ-002-03/05; REQ-003-03; REQ-004-02/05.

### F04. Varias mesas y pedidos sin mezclar información

**Ejecutan:** cajero y preparación. **Módulos:** Caja → Venta/Comandas.

1. Crea pedidos separados para mostrador, Mesa 1 y Mesa 2; asigna distintos productos, notas y clientes.
2. Cambia entre pestañas, renombra una mesa, aumenta una cantidad y elimina una línea aún no preparada.
3. Envía una comanda, agrega otro producto y vuelve a enviarla; preparación comprueba qué es nuevo.
4. Recarga y verifica cada pedido. En un ensayo separado, cierra pestañas vacías hasta no dejar ninguna.

**Debe ocurrir:** no se cruzan clientes, productos ni notas; la comanda permite identificar los cambios sin preparar dos veces por error. Un pedido sobrevive a recarga. Cerrar la última pestaña vacía deja cero pedidos hasta pulsar +, sin generar una venta nueva.

**Evidencia:** pedidos antes/después y comandas sucesivas. **Trazabilidad:** REQ-004-01/02; AC-012-01/02; plan funcional §4, pestañas de pedidos.

### F05. Crear cliente, producto y receta sin abandonar la venta

**Ejecuta:** cajero online. **Módulos:** Caja, Clientes, Productos y Recetas.

1. Con dos líneas guardadas, crea un cliente ficticio con nombre, documento y celular; selecciónalo.
2. Intenta repetir su documento y omitir un campo obligatorio; corrige sin perder el pedido.
3. Crea un terminado con formulario completo. Crea además un preparado con receta borrador incompleta; intenta ofrecerlo para vender, completa las cantidades/conversiones y actívalo.
4. Regresa al pedido y verifica sus líneas. Repite el intento de alta durante un corte de internet.

**Debe ocurrir:** alta online disponible al cajero; sin duplicar cliente ni borrar el pedido. No se habilita un preparado incompleto. El cajero no ve costos. Offline se explica la restricción de altas y se puede seguir vendiendo con el catálogo y clientes descargados.

**Evidencia:** pedido conservado, validaciones y receta activada. **Trazabilidad:** AC-004-01; REQ-002-01/03; AC-005-01; REQ-005-01.

### F06. Descuento, domicilio, propina y puntos en la misma venta

**Ejecuta:** cajero; dueño verifica cálculo. **Módulos:** Caja y Fidelización.

1. En un domicilio manual, agrega 2 unidades de B: $20.000. Completa los datos de entrega aplicables y asigna cliente inscrito con 500 puntos.
2. Aplica descuento de 10% a ambas unidades: productos netos $18.000.
3. Agrega envío $3.000, propina voluntaria 10% y canje de 100 puntos ($1.000).
4. Cobra y revisa comprobante, puntos y reporte después de sincronizar. Repite sin propina; prueba también un descuento fijo válido y otro superior al valor de la línea.

**Debe ocurrir:** propina $1.800; dinero por pagar $21.800; base de acumulación $17.000; 17 puntos ganados. Saldo final 417 puntos si no hay otros movimientos. Límite de canje $3.600 = 360 puntos. Envío, propina y canje se muestran separados; no requieren autorización los descuentos válidos. Descuento excesivo y canje fuera del límite se rechazan.

**Evidencia:** desglose independiente y libro de puntos. **Trazabilidad:** REQ-004-02/04; AC-004-06; REQ-005-02/04/05; AC-005-07. El seguimiento de reparto después de cerrar el pedido no se presume implementado.

### F07. Dividir una cuenta y combinar medios de pago

**Ejecuta:** cajero. **Módulos:** Caja y Fidelización.

1. Abre un pedido con 4 unidades de B, sin extras, propina ni descuento.
2. Cliente A paga 2 unidades: $15.000 por Nequi y $10.000 recibidos en efectivo.
3. Cliente B paga las otras 2 con tarjeta; identifica a cada cliente en su cobro.
4. En otro pedido de $20.000 intenta registrar $25.000 digitales. Repite con pago insuficiente y los demás medios disponibles: transferencia, Bre-B y Daviplata.

**Debe ocurrir:** primer cobro $20.000, efectivo aplicado $5.000 y cambio $5.000; quedan 2 unidades pendientes. Dos comprobantes independientes y 20 puntos para cada inscrito. Cada parte consume solo sus unidades. No se acepta excedente digital como cambio en efectivo ni un pago insuficiente como venta completada.

**Evidencia:** ambos comprobantes, remanente del pedido, consumo total y pagos por medio. **Trazabilidad:** AC-004-04/07/10; REQ-006-02.

### F08. Cancelar después de enviar a preparación

**Ejecutan:** cajero y preparación; inventario verifica. **Módulos:** Caja → Venta/Comandas; Informes de desperdicio.

1. Envía 3 unidades de B a preparación, sin cobrar.
2. Preparación informa que terminó 2; el cliente cancela las 3.
3. El cajero confirma cancelación con motivo e indica las 2 preparadas. Recarga y sincroniza de nuevo.

**Debe ocurrir:** desperdicio equivalente a 2 recetas: 200 g P, 400 ml L y 2 vasos; la tercera no consume. No hay ingreso ni puntos de venta. No se pide autorización de otro usuario. La cancelación y el desperdicio quedan registrados una sola vez.

**Evidencia:** confirmación de preparación, motivo y movimientos. Repetir eliminando parte de una línea enviada. **Trazabilidad:** AC-004-03/08; REQ-003-04.

### F09. Devolución posterior al cobro

**Ejecutan:** cajero solicita y encargado realiza con su cuenta. **Módulos:** Comprobantes, Inventario y Fidelización.

1. Vende dos productos de ensayo iguales de $10.000, usando 100 puntos y $19.000 en dinero.
2. Devuelve uno; comprueba que el cajero sin permiso no puede efectuar la devolución y el encargado de la sede sí.
3. Repite con un terminado recuperable y con un preparado no recuperable. Prueba devolución parcial de propina/envío cuando existan en la venta.
4. Intenta devolver más unidades o importes que lo pendiente por devolver.

**Debe ocurrir:** por uno de los dos productos se restituyen 50 puntos usados y $9.500 en dinero; también se revierten los puntos ganados que correspondan al reparto documentado. No se convierten puntos en efectivo. Solo lo recuperable regresa a inventario; lo no recuperable no descuenta la receta por segunda vez. Se conserva la venta original y el vínculo de devolución.

**Variante:** cliente con 3 puntos y reversión de 10 queda en −7; puede comprar, pero no canjear sin saldo suficiente. **Evidencia:** venta/devolución relacionadas, pago, inventario y puntos. **Trazabilidad:** REQ-004-06; REQ-003-04; AC-005-06/08.

### F10. Operar sin internet y recuperar el navegador

**Ejecutan:** cajero y encargado; apoyo técnico para simular vencimiento. **Módulos:** Caja, sincronización y Resumen.

1. Con activación vigente, corta internet; conserva un pedido y cobra otro a cliente previamente inscrito.
2. Cierra todas las pestañas y el navegador; vuelve a abrir el mismo perfil aún offline. En el equipo de ensayo, prueba también reiniciar Windows.
3. Recupera pedido, turno y comprobante; realiza cierre offline. Vuelve a conectar con el sitio abierto.
4. Interrumpe una reconexión y reintenta. En una prueba técnica aislada, lleva la autorización al límite de siete días y supera el plazo.

**Debe ocurrir:** conservación de datos y numeración, puntos pendientes claramente indicados y una sola venta/consumo/pago/acumulación después del acuse central. Canjes, altas, cambio de sede y administración requieren conexión. Pasados siete días se bloquean nuevos cobros y aperturas, pero se conservan consulta autorizada, pedidos y cierre. No alterar el reloj del equipo comercial para ejecutar la variante temporal.

**Evidencia:** IDs e importes antes del corte, después de reinicio y en el servidor; pendientes solo se eliminan tras confirmación. **Trazabilidad:** REQ-007-01/02/03; AC-012-02; AC-005-03. Con el navegador cerrado no se promete sincronización.

### F11. Doble clic, dos pestañas y respuesta perdida

**Ejecutan:** cajero y apoyo técnico. **Módulos:** Caja y Fidelización.

1. En dos pestañas del mismo perfil intenta cobrar la misma revisión de un pedido; prueba también doble clic.
2. Simula pérdida de respuesta al confirmar un canje online y usa el flujo de recuperación disponible.
3. Desde Milán y Centro intenta canjear simultáneamente un saldo ficticio que solo alcance para uno.

**Debe ocurrir:** una sola venta para el mismo cobro; el otro intento recibe conflicto o el resultado ya confirmado. El canje incierto conserva el pedido y permite recuperarlo sin otro cargo. El total de puntos usados entre sedes nunca excede el saldo.

**Evidencia:** identidad de operaciones y conteos centrales de ventas, consumo, pagos y puntos. Una captura de éxito por sí sola no basta. **Trazabilidad:** AC-012-03/04; AC-005-04; AC-004-05.

### F12. Registrar movimientos, corregir y cerrar el turno

**Ejecutan:** cajero y encargado. **Módulos:** Caja → Turno; Informes de caja.

1. En turno aislado: base $150.000, cobros netos en efectivo $386.000 y retiro de efectivo $50.000, sin otros movimientos que afecten efectivo.
2. Registra ventas digitales aparte y comprueba que no aumentan el dinero esperado en el cajón.
3. Cuenta $480.000 y cierra. El encargado revisa responsable y diferencia.
4. En otro turno, registra un ingreso/gasto manual erróneo y corrígelo mediante contrapartida; intenta un movimiento manual sin conexión.

**Debe ocurrir:** esperado $486.000; diferencia −$6.000. Ventas, propinas, envíos, devoluciones y movimientos están separados sin sumarlos dos veces. La corrección conserva el registro original. El cierre persiste y sincroniza una vez. Los movimientos manuales requieren conexión en la implementación actual; el cierre sí funciona offline.

**Evidencia:** libro del turno y cierre coincidente con Administración. **Trazabilidad:** AC-006-02/03/04/06; REQ-006-02/03.

## Flujos de inventario y abastecimiento

### F13. Recibir una compra pagada

**Ejecutan:** inventario y encargado de sede. **Módulos:** Compras y proveedores; Inventario.

1. Online, crea/selecciona proveedor y registra una compra de 1 kg de P para una bodega con 1.000 g iniciales.
2. Registra precio de compra, importe pagado y medio con cifras de ensayo coherentes; valida y confirma.
3. Reintenta la misma operación y consulta desde la otra sede y desde una cuenta de cajero.

**Debe ocurrir:** entrada única de 1.000 g, saldo 2.000 g en la bodega elegida. El encargado ve los importes de su compra, sin obtener costos de recetas ni márgenes. Cajero sin permiso y encargado fuera de su alcance no acceden. No se crean cuentas por pagar.

**Evidencia:** compra, proveedor, movimiento y permisos. Si el dinero salió del cajón, conciliar el retiro correspondiente con el pago y comprobar que no se contabiliza dos veces; no presumir que registrar una compra genera automáticamente ese retiro. **Trazabilidad:** AC-003-05/09; REQ-003-02.

### F14. Despachar de una bodega y recibir parcialmente

**Ejecutan:** inventario de origen y destino; dueño si requiere acceso a ambas sedes. **Módulos:** Traslados e Inventario.

1. Con 20 unidades en origen y 0 en destino, crea traslado de 10.
2. Despacha 10; recibe 6 en destino y después las otras 4.
3. Repite una confirmación de recepción e intenta recibir una unidad adicional.

**Debe ocurrir:** después del despacho, origen 10 y destino aún 0; primera recepción: destino 6 y pendientes 4; recepción final: destino 10 y pendientes 0. Reintentar no repite cantidades y el exceso se rechaza. El tránsito explica la diferencia temporal entre sedes.

**Evidencia:** documento y movimientos de despacho/recepciones por bodega. **Trazabilidad:** AC-003-03/10.

### F15. Contar existencias y registrar pérdidas o consumo interno

**Ejecutan:** inventario y encargado. **Módulos:** Conteos y ajustes; Inventario; Informes.

1. Sistema muestra 10 unidades; inventario cuenta 8. Confirma conteo y motivo de diferencia.
2. Consulta el ajuste resultante y repite el envío de la misma operación.
3. En casos separados, registra desperdicio, daño según la clasificación disponible y consumo interno; revisa su clasificación en los informes.

**Debe ocurrir:** un ajuste de −2, saldo 8 y conservación del saldo esperado, contado, responsable y motivo. No se reescribe historia ni se registran salidas internas como ventas. Si el formulario no distingue una categoría necesaria, registrar la brecha con el encargado.

**Evidencia:** conteo, ajuste y saldos; motivos comprensibles para quien revisa después. **Trazabilidad:** AC-003-11; REQ-003-02/04; REQ-001-04.

### F16. Vender con faltantes y atender mínimos

**Ejecutan:** cajero, inventario y encargado. **Módulos:** Caja; Inventario; Resumen/Informes.

1. Con 50 g de P, cobra B que consume 100 g.
2. Comprueba la alerta y sincroniza; inventario revisa el saldo y el mínimo configurado.
3. Investiga con movimientos y conteo si falta registrar una compra o existe una diferencia física; registra solo la corrección justificada.

**Debe ocurrir:** venta permitida, P en −50 g y alerta visible; reintentar no vuelve a consumir. El encargado puede detectar la necesidad de reposición. No se inventan entradas para hacer desaparecer el negativo.

**Evidencia:** venta, alerta y decisión operativa. **Trazabilidad:** AC-003-02; REQ-003-01/03. La entrega real de alertas por WhatsApp está diferida y no condiciona este caso.

### F17. Cambiar el catálogo sin alterar ventas anteriores

**Ejecutan:** personal autorizado online, preparación e inventario. **Módulos:** Productos, Recetas, Caja.

1. Cobra B con su primera versión y guarda el comprobante.
2. Cambia el precio o receta con motivo, sincroniza Caja y crea un pedido nuevo.
3. Revisa que la nueva venta use la versión actual y la anterior conserve su precio, receta e impuesto.
4. Archiva un producto de ensayo, sincroniza ambas sedes, verifica listas operativas y luego restáuralo.

**Debe ocurrir:** catálogo compartido y consumo según la versión usada en cada venta. Archivar no borra saldos ni historia; restaurar conserva versiones. Una caja desconectada puede conservar su catálogo anterior hasta sincronizar: debe explicarse esa limitación al personal.

**Evidencia:** versiones y comprobantes, estado de archivo/restauración y auditoría. **Trazabilidad:** REQ-002-05; AC-004-11; AC-013-01/02/03/04.

## Flujos de administración y control

### F18. Comparar sedes y conciliar toda la jornada

**Ejecutan:** dueño y encargados. **Módulos:** Resumen, Informes, Ventas, Caja e Inventario.

1. Consulta Milán, Centro y el consolidado con el mismo período, en hora de Colombia.
2. Deja una sede con ventas offline pendientes y verifica cómo se informa la antigüedad del dato central.
3. Sincroniza y concilia comprobantes, devoluciones, descuentos, puntos usados, propinas, envíos y medios de pago.
4. Selecciona una venta preparada y reconstruye el consumo desde su receta/versiones; selecciona un cierre y reconstruye el efectivo.

**Debe ocurrir:** no se presenta información central incompleta como total actualizado. Tras sincronizar, la suma de sedes coincide con el consolidado bajo los mismos filtros. Cada diferencia tiene una causa identificable, no un ajuste sin explicación.

**Evidencia:** reporte por sede/consolidado e IDs de operaciones conciliadas. **Trazabilidad:** REQ-008-01/04; AC-008-03/04; REQ-006-03.

### F19. Exportar y usar el Excel fuera del sistema

**Ejecutan:** dueño y encargado. **Módulos:** Informes.

1. Usa un conjunto sintético con 120 registros filtrados y pantalla paginada a 20.
2. Descarga el archivo y ábrelo; comprueba filas, período, sede, fecha de generación y totales.
3. Repite para caja, inventario, compras, desperdicio y fidelización, según sus filtros disponibles.
4. Descarga con cada rol, incluyendo una cuenta sin acceso a la otra sede.

**Debe ocurrir:** exporta las 120 filas, con el mismo alcance y totales del informe; el archivo abre correctamente. No expone costos ni datos de sedes no autorizadas. Separar devoluciones/propinas/envíos en lugar de confundirlos con venta bruta de productos.

**Evidencia:** archivos de ensayo y comparación de cantidades/totales. **Trazabilidad:** AC-008-01/02/04.

### F20. Revisar costos sin inventar rentabilidad

**Ejecuta:** dueño; encargado/cajero verifican restricciones. **Módulos:** Inventario, Recetas y conciliación de costos.

1. Consulta una receta cuyo insumo no tiene costo fiable: debe indicar pendiente/desconocido.
2. Registra una conciliación de ensayo de $2 por unidad base con fecha efectiva y motivo.
3. Consulta el costo actual y luego la venta, movimientos y exportaciones anteriores.
4. Repite la consulta con encargado y cajero; el apoyo técnico verifica también la respuesta del servidor.

**Debe ocurrir:** el dueño puede usar el costo conciliado en la consulta actual; se conserva el registro causal y no se modifica historia. Otros roles no reciben costos de recetas ni márgenes, aunque el encargado pueda consultar importes de compras de su sede.

**Límite explícito:** la especificación 014 conserva pendiente el margen histórico hasta tener valoración causal de las salidas. Si el dueño necesita rentabilidad histórica o promedio ponderado completo desde el primer día, registrar esa necesidad como brecha de alcance; este ensayo no acredita esas capacidades.

**Evidencia:** costo pendiente/conciliado, permisos e historia conservada. **Trazabilidad:** AC-003-04; AC-014-01/02/03; REQ-008-02.

### F21. Administrar accesos y explicar una operación en auditoría

**Ejecutan:** dueño, encargado y cajero; apoyo técnico para acceso directo.

1. Configura cuentas y alcance por sede. Con cajero prueba descuentos, cancelación previa y altas online; con encargado prueba compra y devolución de su local.
2. Intenta con cajero una devolución no autorizada y con encargado acceder a otra sede, costos de receta o ajuste de puntos.
3. El dueño ajusta puntos de ensayo con motivo; consulta auditoría de esa acción, una cancelación, compra y corrección de efectivo.
4. Cambia de dueño a cajero en el mismo navegador; verifica que costos no quedan expuestos por datos descargados. Complementa con comprobación de API y exportaciones.

**Debe ocurrir:** permisos coherentes entre pantalla, servidor y archivos. La auditoría permite identificar quién, qué, cuándo, sede y motivo cuando aplica. Un cambio de permisos realizado mientras una caja está offline se evalúa con la política de autorización offline vigente; no se promete revocación instantánea sin conexión.

**Evidencia:** matriz de acciones permitidas/rechazadas y eventos relacionados. **Trazabilidad:** REQ-001-01/02/03/04; AC-005-05; AC-008-02; REQ-007-03.

### F22. Alternar sedes y abrir otro navegador sin perder pendientes

**Ejecutan:** dueño y encargado autorizado. **Módulos:** Caja y selector de sucursal.

1. Con turno y pedido en Milán, sincroniza y cambia a Centro; vuelve a Milán y recarga.
2. Repite el cambio con fallo de sincronización y sin internet.
3. El dueño activa otro navegador para la misma caja sin invalidar el primero; intenta abrir turno mientras sigue activo en el navegador original.

**Debe ocurrir:** cambiar online tras sincronizar puede conservar el turno abierto. Cada sede recupera sus datos; si falla, permanece el perfil anterior. Otro navegador no recibe automáticamente pedidos ni pendientes locales del primero, no los borra y no puede abrir un segundo turno comercial de la misma caja.

**Evidencia:** pedidos/turnos por sede e instalación y mensajes de restricción. **Trazabilidad:** AC-018-01/02/03/04. Esta regla reemplaza la antigua restricción que obligaba a cerrar el turno para cambiar de sede.

## Validación física y recuperación

### F23. Trabajar con impresora y cajón reales

**Ejecutan:** cajero, preparación y responsable presencial de cada sede.

Ejecutar [el protocolo físico existente](hardware-acceptance.md): comprobante, comanda, ambos offline, cancelación/error de impresión, reimpresión, reinicio y método de apertura del cajón. Usar T80A en Milán y NP / New Print T82E en Centro, desde el navegador real, en papel de 80 mm.

**Debe ocurrir:** documentos legibles, importes completos y comandas utilizables por preparación. Error de impresora nunca obliga a cobrar de nuevo. Registrar aparte si el cajón abre con el método disponible; cualquier excepción debe quedar resuelta o aceptada explícitamente según la puerta operativa existente.

**Evidencia:** fotos/escaneos de ensayo, navegador/controlador y resultado por equipo. **Trazabilidad:** HW-01 a HW-07; GO-05. Una vista previa o PDF no acredita funcionamiento físico.

### F24. Recuperar información tras una falla

**Ejecutan:** dueño y responsable técnico; cajero comprueba la continuidad.

1. Crea datos sintéticos sincronizados identificables y verifica su inclusión en un respaldo.
2. Restaura en un destino aislado; compara documentos, importes, inventario, turnos y puntos, además de conteos de filas.
3. Mide tiempo de recuperación y último dato recuperable. Documenta responsable, retención, pérdida máxima aceptable de datos (RPO) y tiempo máximo de recuperación (RTO).
4. Compara con una venta que siga únicamente en el navegador sin sincronizar; comprueba y explica que el respaldo central no la cubre. Diseña el ensayo sin destruir su perfil.

**Debe ocurrir:** recuperación demostrada sin sustituir la base activa y conciliación de hechos recuperados. No presentar una copia en el mismo disco como protección ante pérdida del equipo, ni una restauración local como prueba del servicio alojado.

**Evidencia:** ejecución de restauración aislada, diferencias, tiempos y cobertura. **Trazabilidad:** REQ-011-04; GO-04; [puertas de ventas reales](real-sales-readiness.md).

## Caso adicional si la importación Excel entra en la versión de lanzamiento

**X01 — Carga de catálogo, no de existencias.** Dueño o usuario con permisos adecuados descarga la plantilla de Productos → Importar Excel; carga un terminado, un preparado y su receta, revisa vista previa y confirma. Antes, prueba una referencia de ingrediente inválida y una conversión ausente: el error debe señalarse sin alta parcial. Repite la confirmación de la misma vista previa y comprueba una sola creación. Verifica que no altera costos, compras ni existencias iniciales. Una vista previa de otro usuario no debe poder confirmarse. Referencia: [contrato funcional de importación Excel](../excel-import.md). Esta capacidad tiene cambios locales en la copia revisada; incluirla solo si está en la compilación candidata, sin darla por desplegada.

## Cómo ejecutar la validación con el personal

Se propone esta secuencia; los tiempos se miden durante el ensayo, no se presentan como rendimiento ya comprobado.

| Jornada | Recorrido | Participantes |
| --- | --- | --- |
| 1. Servicio completo | F01 → F02 → F03 → F04 → F05 → F06 → F07 → F08 → F09 → F12 → F18 | Los cinco roles, cada uno en su tarea |
| 2. Abastecimiento y control | F13 → F14 → F15 → F16 → F17 → F19 → F20 → F21; X01 si aplica | Inventario, encargado y dueño |
| 3. Contingencias | F10 → F11 → F22 → F23 → F24 | Caja, preparación, encargado, dueño y apoyo técnico |

Para evitar que la ayuda oculte problemas de usabilidad, dar primero al operador el objetivo del caso y dejar que lo complete. El observador usa los pasos de esta guía para comparar el resultado; si interviene, registra la ayuda. Tras corregir, repetir el caso sin orientación.

Registrar para cada rol: tarea completada, tiempo observado, errores, dudas, pasos que obligaron a usar papel/calculadora/otro sistema y comentario de quien opera. La pregunta práctica es si puede terminar su trabajo correctamente durante un servicio, y si la siguiente persona recibe información suficiente para continuar.

Realizar además un tramo de demanda representativa con varias mesas, un domicilio, cobros divididos y una cancelación mientras preparación trabaja. Medir tiempos y pedidos confundidos. El volumen pico real no está establecido: usar el que el personal reconozca como representativo y registrar explícitamente la carga; no inventar una certificación de capacidad.

En los recorridos, verificar teclado, legibilidad, formularios, tema claro/oscuro y el tamaño de pantalla usado por cada persona. Si el móvil se usa para administración, ejecutar allí consulta, filtros y descarga; la prueba de caja y hardware se hace también en los computadores reales de las sedes.

## Registro de resultados

Cada fila representa una ejecución, no una casilla de aprobación documental. Al iniciar una nueva ronda, todos los casos parten **No ejecutado**. La ronda del 25-09-2026 está registrada en [el informe de ejecución](../evidence/validacion-navegador-2026-09-25.md).

| Caso y variante | Sede / versión | Operador y rol | Fecha y duración | Resultado observado | Evidencia / IDs | Estado | Incidencia / responsable / repetición |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F__ | | | | | | No ejecutado | |

Estados: **Aprobado**, **Falló**, **Bloqueado** (no se pudo ejecutar por dependencia real) y **No ejecutado**. No marcar aprobado un caso porque exista una prueba automatizada de una versión anterior.

Clasificación propuesta para priorizar hallazgos:

- **Crítico:** pérdida/duplicación de venta, dinero, puntos o inventario; fuga de costos/datos; imposibilidad de cobrar, recuperar pendientes o cerrar. Resolver y repetir antes de recomendar salida.
- **Alto:** un rol no completa una tarea necesaria, comanda ambigua, informe/exportación incorrecto, permisos que obligan a compartir cuenta. Corregir o someter una excepción concreta al dueño con su impacto y procedimiento temporal.
- **Menor:** dificultad visual o de texto que no altera el resultado; registrar responsable y prioridad. Una acumulación de dificultades puede convertirse en problema operativo alto.

## Criterio propuesto de aceptación y estado del lanzamiento

Recomendar la aceptación funcional solo cuando los flujos de dinero, inventario, puntos, permisos, persistencia y conciliación aplicables a la versión pasen en ambas sedes, no haya incidentes críticos abiertos y cada uno de los cinco roles confirme que puede completar sus tareas. Registrar expresamente toda brecha o excepción; no inferir aceptación por silencio.

La aceptación con el personal complementa las puertas existentes; no reemplaza la autorización de operación. Según [el registro operativo vigente](real-sales-readiness.md), GO-01 y GO-02 están completadas para el piloto; GO-04 sigue pendiente de parámetros y restauración, GO-05 de hardware y GO-06 de autorización de arranque conjunto. Son estados documentados, no verificaciones nuevas realizadas en esta revisión.

La carga restante de inventario puede continuar progresivamente con datos revisados; no convertirla en una nueva condición distinta de GO-02. Historial de Alegra y WhatsApp real están diferidos. Fiscalidad externa no es puerta de esta versión. No añadir tienda online, integración bancaria ni pantalla de cocina como supuestos de aceptación.

Hay textos históricos que aún dicen que no existe despliegue o que ciertos incrementos están pendientes, mientras el README y evidencias posteriores documentan avances. Para ejecutar este plan, fijar la compilación candidata y comprobar en ella las capacidades; no usar esos encabezados antiguos como prueba de ausencia ni las evidencias anteriores como garantía del estado actual.

## Fuentes locales utilizadas

- [Plan funcional y reglas del negocio](../../software-nativos.md), especialmente §§4–11 y §16.
- [Instrucciones del proyecto](../../agents.md) y [README vigente](../../README.md).
- Especificaciones [003 inventario](../../specs/003-inventory-purchases/spec.md), [004 ventas](../../specs/004-sales/spec.md), [005 clientes/puntos](../../specs/005-customers-loyalty/spec.md), [006 caja](../../specs/006-cash/spec.md), [008 informes](../../specs/008-reports/spec.md), [012 web/offline](../../specs/012-unified-web/spec.md), [013 catálogo](../../specs/013-catalog-lifecycle/spec.md), [014 costos](../../specs/014-cost-reconciliation/spec.md) y [018 acceso a cajas](../../specs/018-caja-access/spec.md).
- [Evidencia administrativa del incremento 6](../evidence/increment-6.md), [reglas de permisos implementadas](../../src/permissions.ts), [interfaz de Caja](../../web/Pos.tsx) y [módulos administrativos](../../web/main.tsx).

Este documento registra el diseño de escenarios. La ejecución posterior está en el [informe de navegador](../evidence/validacion-navegador-2026-09-25.md) y las correcciones y repetición de pruebas en la [evidencia actualizada](../evidence/correccion-flujos-2026-09-25.md). Las pruebas de hardware y la validación presencial con el personal conservan los límites descritos allí.
