# Validación de flujos de Nativos en navegador — 25-09-2026

**Registro histórico anterior a las correcciones.** NAT-UAT-01/02/03 fueron corregidos después de esta ejecución y superaron la [nueva validación local de 18 casos](correccion-flujos-2026-09-25.md). Se conservan aquí los fallos originales y los límites del ensayo; no representan el estado final del código local.

## Resultado

**No se acredita todavía que todos los flujos estén listos para lanzamiento.** Se ejecutaron recorridos reales en navegador y se encontraron tres problemas funcionales: restauración local fallida con ventas, exclusión de productos terminados en compras/traslados/conteos, y un filtro de informes que ofrece solo 100 de los 254 productos publicados.

El núcleo de caja superó los escenarios ejecutados de cobro, preparación, descuentos, propinas, puntos, división de cuentas, devoluciones, persistencia offline y recuperación de respuestas perdidas. Los resultados se limitan a las variantes descritas en esta evidencia; no equivalen a certificar todas las combinaciones posibles ni las impresoras físicas.

## Entornos y método

- **Sitio publicado:** `https://nativos-web-production.up.railway.app/`, inspeccionado en el navegador integrado con la sesión existente. Navegación, búsqueda, filtros, consulta de comprobantes y apertura de formularios sin guardarlos. No se registraron ventas, compras, conteos, traslados, clientes ni modificaciones de catálogo en ese sitio.
- **Pruebas con escritura:** Edge real automatizado, en una aplicación local compilada y bases PostgreSQL nuevas con datos sintéticos. Caja utiliza el navegador y su persistencia IndexedDB. Las pruebas no se ejecutaron sobre la base real ni copiaron datos privados del negocio.
- **Versión local:** commit `601ef7010fef6b9b7fb74f90194d160133d6ff97`. El SHA del despliegue publicado no se identificó desde su interfaz: los resultados locales no certifican por sí solos que Railway ejecute exactamente ese commit.
- **Roles:** dueño, encargado y cajero. Las necesidades de preparación se probaron mediante comandas; las de inventario mediante las funciones administrativas. No se inventaron perfiles de acceso adicionales.
- **Preparación del ensayo adicional:** cuentas, catálogo, recetas e inventario inicial sintéticos creados mediante las API del servidor local. Los recorridos posteriores se realizaron mediante formularios, botones y descargas del navegador. Las comprobaciones de ventas, cantidades y saldos se contrastaron con el servidor y la base aislada.
- Para probar volumen, se insertaron 120 turnos sintéticos cerrados como precondición. No se presentan como 120 aperturas realizadas manualmente en la interfaz.
- No hubo comunicaciones reales por WhatsApp, cambios en Alegra, pagos bancarios, publicación ni cambios de código del producto.

## Ejecuciones y artefactos

| Ejecución | Resultado | Alcance |
| --- | --- | --- |
| `npm.cmd run test:e2e` | Aprobada; 1 prueba principal con múltiples recorridos; 2,9 minutos totales | Suite de navegador existente, ejecutada en esta revisión, con los ayudantes de catálogo, caja, compras, inventario, fidelización y offline |
| `node scripts/validate-workflows.ts` | **13 aprobados y 4 fallidos**, 17 casos; ejecución `2026-09-25T14-32-47-117Z` | Casos adicionales del plan, conciliaciones numéricas y reproducción de defectos |
| `npm.cmd run check` | Aprobada, código de salida 0 | Tipos, pruebas unitarias, 64 pruebas de integración aprobadas y compilación |
| `npm.cmd run typecheck` | Aprobada después de agregar el ejecutor | Verificación del script y el proyecto; no sustituye la ejecución en navegador |

La suite principal es una prueba extensa con varios recorridos, no 24 pruebas independientes. Las pruebas de integración complementan el navegador; no se contabilizan como interacciones de una persona.

Los primeros ensayos del ejecutor adicional detectaron también errores de selectores, una consulta al nombre incorrecto de una tabla, espera insuficiente del refresco offline y comparación de decimales como cadenas. Se corrigió la automatización y se repitió sobre bases nuevas. Esos errores del ejecutor no se reportan como defectos de Nativos. No se modificó el producto para conseguir aprobaciones.

Artefactos conservados:

- [Resultados del ensayo adicional](validacion-navegador-2026-09-25/results.json).
- [Errores HTTP observados](validacion-navegador-2026-09-25/server-errors.json) y [error de restauración en PostgreSQL](validacion-navegador-2026-09-25/database-errors.txt).
- [Comprobante de $21.800](validacion-navegador-2026-09-25/B06-receipt.png).
- [Excel descargado desde Informes](validacion-navegador-2026-09-25/caja-exportada.xlsx).
- [Archivo sintético usado en importación](validacion-navegador-2026-09-25/catalogo-sintetico.xlsx).
- [Comprobante recuperado tras cerrar y reabrir offline](validacion-navegador-2026-09-25/suite/offline-restart-receipt.png).
- [División de cuenta y pago mixto](validacion-navegador-2026-09-25/suite/desktop-split-receipt.png).
- [Ejecutor reproducible](../../scripts/validate-workflows.ts). Ejecutar después de `npm.cmd run build`; crea bases aisladas y termina los procesos utilizados. Sale con código 1 mientras persistan casos fallidos.

## Hallazgos que requieren corrección

### NAT-UAT-01 — Restauración local falla con movimientos de ventas — Alta

**Rol afectado:** dueño/responsable de recuperación. **Flujo:** F24. **Entorno demostrado:** local aislado.

Pasos ejecutados:

1. Vender un producto y sincronizar su consumo de inventario.
2. Entrar a Respaldo y recuperación y crear un respaldo.
3. Verificar su integridad SHA-256: la interfaz confirma éxito.
4. Elegir Ensayar restauración, escribir la confirmación exacta y ejecutar Restaurar y conciliar.

**Obtenido:** respuesta HTTP 400, código `invalid_reference`, mensaje «Revisa las referencias y los permisos». La restauración no se concilia. PostgreSQL registra `inventory_movements_sale_id_fkey`: se intenta insertar un movimiento cuyo `sale_id` aún no existe en `pos_sales` del destino.

**Esperado:** restaurar todos los hechos sincronizados y conciliar ventas, turnos, movimientos, clientes y puntos. La copia activa debe conservarse.

**Causa confirmada en código:** la lista de restauración de [backup-api.ts](../../src/server/backup-api.ts) coloca `inventory_movements` antes de `pos_sales`; el bucle inserta las tablas en ese orden. La suite de respaldo previa no había detectado este conjunto con movimientos de venta.

**Corrección a validar:** restauración que respete las dependencias de todas las tablas, y regresión con ventas, desperdicio, compras, traslados, conteos, devoluciones y puntos. Comprobar también el tratamiento del destino parcial después de un error. Que el archivo exista y pase SHA-256 no demuestra recuperabilidad.

[Captura del fallo](validacion-navegador-2026-09-25/B24-failure.png). Esta prueba local no acredita ni descalifica por sí sola el mecanismo PITR externo de Railway; son mecanismos distintos.

### NAT-UAT-02 — No se pueden comprar, trasladar ni contar productos terminados — Alta

**Roles afectados:** inventario, encargado y dueño. **Flujos:** F13, F14 y F15. **Entornos:** local y formulario publicado.

Pasos ejecutados:

1. Disponer de un producto terminado activo, con existencia y ventas. En el ensayo: PRUEBA T; en el sitio publicado: **Achiras, PP-206, producto terminado, $6.000, habilitado v1**.
2. Abrir Registrar compra, Nuevo traslado o Registrar conteo.
3. Buscarlo en Artículo 1.

**Obtenido:** el producto no aparece en ninguno de los tres selectores. En producción, cada selector mostró 111 artículos más la opción inicial; Achiras estaba ausente. Las compras publicadas también piden crear previamente un proveedor, lo cual es una precondición diferente: en el ensayo sí había un proveedor y el terminado siguió ausente.

**Esperado:** gestionar las unidades de productos que se compran listos para vender, además de los insumos. Vender un terminado reduce su saldo correctamente; la exclusión impide completar su ciclo normal de abastecimiento y control.

**Causa confirmada en código:** `i.kind !== 'finished'` en [Purchases.tsx](../../web/Purchases.tsx) y [InventoryOperations.tsx](../../web/InventoryOperations.tsx). Los insumos sí completaron compra, despacho, recepción parcial/final, conteo y consumo interno.

**Corrección a validar:** incluir los terminados operativos y conservar las validaciones de unidades, sedes y permisos; repetir los tres casos. No sustituir una compra cotidiana por inventarios iniciales para ocultar la brecha.

Evidencias: [compra](validacion-navegador-2026-09-25/B13-T-failure.png), [traslado](validacion-navegador-2026-09-25/B14-T-failure.png), [conteo](validacion-navegador-2026-09-25/B15-T-failure.png).

### NAT-UAT-03 — El filtro de productos en Informes está incompleto — Media

**Roles afectados:** dueño y personal que consulta informes. **Flujo:** F18. **Entorno:** sitio publicado.

Pasos ejecutados:

1. Consultar Productos: 254 productos.
2. Buscar **LuloMiel 16 onz**, referencia PP-044, $13.000: existe y está habilitado.
3. Abrir Informes → Ventas → Producto.

**Obtenido:** 101 opciones, incluyendo Todos: solo 100 productos seleccionables. LuloMiel 16 onz no aparece; la última opción observada fue Kubeo (con helado) 22 onz.

**Esperado:** poder filtrar por cualquier producto del catálogo autorizado, incluido el que supera la primera página.

**Causa confirmada en código:** [Reports.tsx](../../web/Reports.tsx) solicita una única página con `limit=100` y no recorre el cursor. Los selectores de clientes y proveedores también usan una sola página; su truncamiento no se demostró en navegador porque no había volumen suficiente en esos catálogos.

**Corrección a validar:** completar la paginación o implementar búsqueda paginada; comprobar producto fuera de la primera página y coherencia con Excel. El fallo del selector no demuestra pérdida de ventas en el informe general.

## Resultados funcionales concretos

| Recorrido ejecutado | Resultado comprobado |
| --- | --- |
| Venta de 2 terminados a $5.000, recibe $20.000 | Total $10.000, cambio $10.000, ingreso neto $10.000, existencia 10 → 8. Consultar la copia y sincronizar no crea otra venta. No se probó impresión física. |
| Preparado con sustitución y adicional | Comanda conserva nota/opciones sin consumir. Cobro de $13.000 deja P 900 g; L original 2.000 ml; L2 800 ml; vasos 9; A 180 g. |
| Cliente creado durante pedido | Las dos unidades permanecen en el pedido al guardar y seleccionar el cliente. |
| Descuento + domicilio + propina + puntos | $20.000 − $2.000 descuento − $1.000 canje + $1.800 propina + $3.000 domicilio = **$21.800**. Genera 17 puntos; saldo 500 − 100 + 17 = **417**. |
| Cancelación de tres unidades enviadas a preparación, dos preparadas | Consume 200 g de P por desperdicio; la tercera unidad no consume. No crea venta; sincronizar otra vez no repite la salida. |
| División y pago mixto — suite existente | Una parte de $16.860, pagos combinados, cambio $3.140 y una unidad pendiente en el pedido. Comprobante y cliente conservados tras recarga. |
| Devolución — suite existente | Devolución separada de propina/domicilio; otra devolución restituye 100 puntos utilizados y revierte 11 ganados, con historia visible. |
| Navegador offline — suite existente | Cobro persistido tras cerrar y reabrir el navegador sin red; credencial incorrecta rechazada; al reconectar, sincronización sin copia adicional. |
| Fallos de persistencia y respuesta — suite existente | Aborto de IndexedDB conserva el pedido sin venta parcial; dos pestañas compitiendo producen un comprobante; canje confirmado con respuesta perdida se recupera desde la UI. |
| Vencimiento offline — suite existente | Se simulan ocho días: se bloquea cobrar y se mantiene disponible el cierre. La simulación de reloj no equivale a esperar ocho días reales. |
| Compra por encargado | Proveedor creado por interfaz; compra de 1.000 g a $2/g, total $2.000; stock aumenta exactamente 1.000 g. La UI usa unidad base de solo lectura; no se atribuye a esta compra conversión automática desde kg. |
| Traslado de insumo entre sedes | Despacho de 10 ml; recepción de 6 y luego 4. Intento de recibir 5 cuando faltaban 4 rechazado y sin cambio de existencias. |
| Conteo y consumo interno de insumo | A: 180 → 178 g por conteo; luego 178 → 176 g por consumo interno. No aparecen ventas por esas operaciones. |
| Stock negativo | Conteo P=50 g; venta consume 100 g; saldo −50 g, alerta Inventario negativo. Nueva sincronización conserva el mismo saldo. |
| Archivo/restauración del catálogo | Producto archivado y restaurado; saldos y documentos de ventas anteriores permanecen iguales. |
| Conciliación de costo | Pendiente → $2/g; cantidad y ventas anteriores sin modificaciones. Cajero y encargado sin acceso a la acción ni a costos de inventario. |
| Excel | Pantalla de Caja con 20 filas; archivo descargado con **121 filas de datos**, contrastadas con el servidor. La lectura del XLSX se hizo sobre sus hojas XML; no se abrió Microsoft Excel de escritorio. |
| Importación Excel | Vista previa no crea datos; confirmación añade 2 productos, 1 receta y 2 insumos; repetir el archivo produce errores y no crea duplicados. |
| Accesos | Cajero y encargado limitados a Centro, sin Milán; sin ajuste de puntos/reglas/costos. Encargado puede comprar; cajero no tiene esa acción. La suite principal valida usuarios y eventos de auditoría. |
| Caja en otro navegador/sede | Dos perfiles conservan acceso; segundo turno de la misma caja rechazado; Centro/Milán conservan sus turnos y un fallo al cambiar no sustituye el perfil activo. |

## Cierre de efectivo

El recorrido adicional adapta las cifras del plan al mismo conjunto de ventas ensayado: base **$150.000**, cobros netos de efectivo **$54.800**, retiro **$50.000**. Un gasto erróneo de **$1.000** se compensa mediante contrapartida de **$1.000**, conservando ambos registros.

Esperado: **$154.800**. Contado: **$148.800**. Diferencia: **−$6.000**. El cierre se realiza sin conexión y después se sincroniza; el ensayo contrasta esos tres importes en el servidor. Los movimientos manuales se deshabilitan al actualizarse el estado offline; la interfaz refresca ese estado periódicamente, no se acreditó actualización instantánea al cortar la red.

## Cobertura respecto del plan F01–F24

«Verificado» se refiere al recorrido adaptado descrito, no a todas las variantes del plan original. «Parcial» identifica expresamente pruebas originales que no quedaron completas en navegador.

| Flujo | Estado y alcance de esta ejecución |
| --- | --- |
| F01 Apertura y sede | Verificado: apertura, persistencia, cambio de sede, rechazo de segundo turno comercial. |
| F02 Terminado/cambio/copia | Verificado en pantalla y servidor. Impresión física pertenece a F23. |
| F03 Preparado/opciones/comanda | Verificado con consumos exactos y nota visible. |
| F04 Pedidos simultáneos | Verificado por suite: pedidos separados, recarga, cambio entre pedidos y preservación offline. |
| F05 Altas durante atención | Parcial: cliente nuevo dentro del pedido; creación de producto y receta por administración. No se acreditó toda la secuencia producto+receta nuevos desde un pedido en curso. |
| F06 Descuento/propina/puntos | Verificado con el ejemplo numérico del plan. |
| F07 Cuenta dividida | Verificado: pago mixto, cambio, comprobante y saldo pendiente del pedido. |
| F08 Cancelación preparada | Verificado: cantidad preparada consume por desperdicio una sola vez. |
| F09 Devolución | Verificado en las variantes de dinero, propina/domicilio y puntos descritas. |
| F10 Offline/reinicio | Verificado: cierre/reapertura real del navegador offline y vencimiento mediante reloj simulado. |
| F11 Concurrencia/idempotencia | Parcial: dos pestañas y recuperación de canje sin respuesta pasan. No se ejecutó un canje simultáneo entre dos sedes desde dos navegadores en esta sesión. |
| F12 Caja/corrección/cierre | Verificado: retiro, contrapartida, cierre offline y diferencia, con cifras adaptadas. |
| F13 Compras | **Falló para terminados**; pasó compra de insumo por encargado. Unidad base, sin edición de kg en el formulario. |
| F14 Traslados | **Falló para terminados**; pasó insumo entre sedes, recepción parcial/final y rechazo de exceso. |
| F15 Conteos/consumo | **Falló para terminados**; pasó insumo, ajuste de cantidad y consumo sin venta. No se acreditaron todas las categorías de daño/desperdicio administrativo. |
| F16 Negativos/mínimos | Verificado: negativo y mínimo configurado en los recorridos indicados. Sin entrega de WhatsApp real. |
| F17 Versiones/archivo | Parcial: creación de versiones, archivo/restauración e historia conservada; no se repitió en navegador toda la venta antes/después de cambiar receta y sincronizar ambas sedes. |
| F18 Informes/sedes | **Falló el filtro completo de productos**. Los importes visibles de las sedes concilian; no se ensayó central desactualizado de una sede en producción. |
| F19 Exportación | Parcial: descarga de Ventas por suite y Caja con 121 registros por ensayo adicional. No se descargaron todas las clases de informes con cada rol desde navegador. Pruebas de servidor complementarias aprobadas. |
| F20 Costos | Verificado costo actual, saldos/historia y restricciones UI; margen histórico y promedio ponderado completo no acreditados. |
| F21 Accesos/auditoría | Parcial: matriz UI, alcance por sede, alta/edición y eventos de auditoría. No se acreditó todo el conjunto de exportaciones y cambio dueño→cajero en un único perfil con caché previamente cargada. |
| F22 Sedes/navegadores | Verificado en la suite principal; en producción se observó el aviso de turno abierto en otro navegador. No se intentó cerrarlo. |
| F23 Impresoras/cajones | **No ejecutado: requiere los equipos físicos** de Milán y Centro y comprobación de papel/cajón. |
| F24 Recuperación | **Falló restauración local con datos transaccionales**. PITR alojado y tiempos RPO/RTO no ensayados en esta revisión. |
| X01 Importación Excel | Verificado: vista previa, alta íntegra y rechazo de referencia duplicada. |

## Observaciones del sitio publicado

En la consulta realizada, el resumen mostraba **$86.500 y 3 cobros**. Centro: **$27.500 y 1 cobro en efectivo**. Milán: **$59.000 y 2 cobros**, separados en **$24.500 efectivo + $34.500 digital**. La suma de sedes coincide con el resumen. Se consultó el detalle de la venta de Centro, con sus dos productos y siete registros de consumo. El filtro Nequi en Milán dio cero registros.

El catálogo tenía **17 preparados que requieren receta activa** y Caja los mostraba deshabilitados. Es una condición de datos/configuración, no un fallo de permitir vender sin receta. Confirmar cuáles pertenecen al menú de lanzamiento y completar sus recetas antes de ofrecerlos:

Tostada Pera y Miel; Sandwich Toscana; Omelette; Rancho Criollo; Tostada Esmeralda; Waffle de Avena; Desayuno Nativo; Wafle Frutos del Bosque; Pechuga Campestre; Tostada Serrana; Sandwich Vegano; Waffle Tradicional; Lomo del Bosque; Trucha Verde; Tostada Burrata; Sandwich Boreal; Bowl Nativo.

Respaldo y recuperación mostraba **«El respaldo local no está configurado»**. Esto no demuestra el estado de PITR externo; el ensayo de restauración externa continúa pendiente según las puertas operativas existentes.

## Condiciones para cerrar la validación

1. Corregir NAT-UAT-01 y NAT-UAT-02, y repetir los cuatro casos fallidos del ejecutor contra la compilación corregida.
2. Corregir NAT-UAT-03 y repetir el filtro con un producto situado fuera de la primera página.
3. Completar las variantes marcadas Parcial sobre la compilación candidata; no convertir la aprobación de la suite previa en aceptación de las variantes no ejecutadas.
4. Confirmar el menú utilizable y las recetas de los productos que se ofrecerán desde el primer día.
5. Ejecutar hardware real y recuperación PITR aislada conforme a [las puertas operativas](../operations/real-sales-readiness.md). Conservar separados el ensayo local, la evidencia publicada y la aceptación del personal.

Esta revisión entrega resultados de pruebas y reproducción de fallos. No registra autorización de lanzamiento ni reemplaza la validación presencial de preparación, impresión y manejo del cajón.
