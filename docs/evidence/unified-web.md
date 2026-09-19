# Evidencia — Sitio web único (5W / 012)

Fecha: 15-09-2026. Autorizado por el cambio de dirección del usuario y su confirmación de conservar siete días offline. Alcance: nueva arquitectura web y traslado local; no publicación ni operación real en Alegra.

## Resultado implementado

Administración `/` y Caja `/caja` en el mismo origen, cookie web compartida, navegación entre módulos y tema conservado. Caja usa IndexedDB real, Web Locks, Web Crypto y shell offline. Electron se retiró de dependencias/comandos del producto. El lanzador normal inicia únicamente servidor web y PostgreSQL; el servicio antiguo del puerto 4311 se detuvo en desarrollo.

Cálculos, impuestos opcionales, catálogo/recetas, descuentos, división, pedidos, comandas, cancelación preparada, devoluciones, turnos y fidelización reutilizan dominio/servidor existentes. Nuevas operaciones del navegador conservan envolturas v1/v2/v3, secuencia, firma y acuse exacto. Migraciones SQL 001–005 idénticas por SHA-256 al cierre del incremento 5.

## Pruebas ejecutadas

| Verificación | Resultado |
| --- | --- |
| `npm run check` | TypeScript, 33 pruebas de dominio/políticas, 46 pruebas de integración (incluyen 5 padres) y compilación correctas |
| Integración focalizada final | 9/9 pruebas correctas, incluyendo traslado con outbox pendiente exacto |
| `npm run test:e2e` | Flujo integrado correcto en Edge; Administración y Caja usan solo 4320 |
| IndexedDB con aborto inyectado | No sobrevive un cobro parcial; pedido conservado al recargar |
| Pestañas concurrentes | Dos confirmaciones sobre la misma revisión: una sola venta y un comprobante |
| Cierre/reapertura real de Edge | Perfil persistente, conexión desactivada antes de navegar; pedido/comprobante, turno y pendientes recuperados |
| Actualización con pendiente | Un nuevo service worker queda esperando mientras existe un comprobante sin sincronizar; al cerrarse clientes y reabrir offline, IndexedDB conserva el comprobante y pendiente |
| Acceso offline | Contraseña errónea rechazada; contraseña cacheada válida permite volver a entrar; fecha controlada ocho días después bloquea cobros y conserva cierre |
| Canje con acuse perdido | Servidor confirma, transporte aborta respuesta; intención sobrevive recarga offline y recuperar emite un solo comprobante |
| Reconexión/reintento | Pendientes llegan a cero sin repetir ventas; puntos cambian de pendientes a confirmados |
| Caché y accesibilidad | Ninguna respuesta API en Cache Storage; axe, escritorio/móvil, claro/oscuro y teclado en flujos comerciales |
| Traslado anterior | API con PostgreSQL/SQLite/DPAPI reales conserva instalación, secuencia, historia y outbox; E2E UI pierde la respuesta después del commit, reintenta el mismo destino y el dueño vuelve a entrar offline con su contraseña; otro destino recibe 409 y el motor anterior queda bloqueado |
| Verificación de desarrollo | `/` y `/caja` HTTP 200, h1 renderizado y sin pageerror en Edge; solo 4310 escucha como web; setupRequired=false |
| Conservación local | Antes/después del reinicio: 2 pedidos, 1 turno, 3 entradas de outbox ya confirmadas y ningún cobro. No se transfirió a un navegador de pruebas ni se borraron archivos |

### Mantenimiento de cursor — 19-09-2026

Se reprodujo en `develop` una Caja conectada cuyo perfil local conservaba 10 operaciones desde secuencia 1 mientras la terminal central ya había utilizado esa secuencia. El motor presentaba el rechazo persistido como “Sin conexión” y no ofrecía recuperación; por eso los movimientos manuales quedaban deshabilitados aunque la red funcionara.

La autorización ahora entrega el par `serverSequence`/`serverOperationId`; un perfil sin outbox adopta ese cursor antes de crear comandos. Para una cola ya afectada, la interfaz muestra **Revisión necesaria**, conserva todos los pendientes y ofrece **Conciliar pendientes y sincronizar** solo ante el código específico `sequence_conflict` o su mensaje histórico. La acción reencadena la cola completa después de un cursor central recién verificado y conserva `operationId`, payload, `payloadHash`, concesión y orden; cada entrada se elimina únicamente tras su acuse exacto. Otros rechazos continúan bloqueados para revisión técnica.

| Verificación del mantenimiento | Resultado |
| --- | --- |
| `npm run check` | 40/40 pruebas unitarias, 57/57 pruebas de integración, TypeScript y build correctos |
| Integración POS focalizada | 9/9; cursor causal en snapshot, distinción `sequence_conflict`/`operation_conflict` e historial append-only |
| `npm run test:e2e` | 1 flujo integrado correcto en Edge (2,6 min); la prueba introduce una carrera real, confirma el aviso, concilia y llega a 0 pendientes |
| Invariantes de la cola | Prueba unitaria confirma que identidad, payload y hash no cambian; solo secuencia y predecesor se reasignan |
| Caja de desarrollo `127.0.0.1:4310` | Frontend reconstruido y servidor reiniciado sobre la misma base; la pestaña abierta muestra conexión funcional, “Revisión necesaria”, 10 pendientes y la acción de conciliación habilitada |
| Conservación de datos de desarrollo | No se pulsó la conciliación ni se descartó/envió ninguna de las 10 operaciones durante la verificación visual |

Después del check completo se repitieron TypeScript, build/E2E ante cambios del adaptador y la integración focalizada de fidelización/traslado. Ajustes finales de formato horario fijan America/Bogota y no cambian importes. La prueba E2E inicial de reingreso se corrigió para reconocer que la vista Comprobantes se conserva después del login; el acceso ya funcionaba y no se relajó la comprobación de credenciales.

### Recuperación de inventario y permiso de movimientos — 19-09-2026

La Caja visible de Milán conservaba una única venta `sale.split` en secuencia 7 como `reconciliation_required`, con el mensaje histórico de existencias insuficientes y sin código. PostgreSQL permanecía en secuencia 6: la venta no estaba confirmada ni se habían aplicado sus consumos. La regla vigente REQ-003-03 permite inventario negativo con alerta, por lo que no correspondía inventar existencias ni descartar el cobro.

El motor ofrece ahora **Reintentar venta pendiente** únicamente cuando el payload es `sale.charge`/`sale.split` y el rechazo coincide con los códigos históricos de inventario o con el mensaje histórico exacto. La acción conserva operación, payload, hash, secuencia, predecesor y concesión; si el servidor vuelve a rechazar, retorna a conciliación sin reintento automático. La E2E incorpora el rechazo sintético y el reintento explícito.

Sobre `.local/development`, y no sobre la base original ni el piloto, se reintentó la operación existente. El resultado observado fue `Sincronizado`, 0 pendientes, un acuse, una venta y cinco movimientos de consumo para la misma identidad. Los saldos quedaron negativos y la alerta permanece visible, como exige el producto.

El botón **Registrar ingreso o salida** continuaba deshabilitado porque el dueño de desarrollo había sido creado antes de existir `cash.movement`. La migración aditiva 019 agrega ese permiso predeterminado una sola vez a usuarios humanos anteriores, sin reemplazar otros permisos ni modificar agentes. Tras reiniciar el servidor y renovar la concesión, el botón quedó habilitado y abrió el formulario real de Ingreso/Gasto/Retiro; no se registró un movimiento de prueba.

Verificación focalizada: `npm run typecheck` correcto, `npm test` 46/46, `npm run build` correcto y `git diff --check` sin errores. La integración aislada de pedidos se intentó dos veces, pero `initdb` agotó su límite de 60 segundos antes de ejecutar los escenarios; la verificación real anterior confirmó en la base de desarrollo un solo acuse/venta y cinco consumos. El servidor reiniciado responde HTTP 200 en 4310 y PostgreSQL de desarrollo escucha en 54329.

## Evidencia visual

Revisadas [venta recuperada offline](unified-web/offline-restart-receipt.png), [canje incierto](unified-web/pending-redemption.png), directorio/fidelización en escritorio y móvil y regresión de pedidos. Capturas propias bajo `unified-web/`, sin sobrescribir las de incrementos 0–5. Se corrigió el aviso vacío cuando el bloqueo correspondía a un canje pendiente.

## Trazabilidad

- AC-012-01: `tests/e2e/pos-flow.ts`, `loyalty-flow.ts`, `foundation.spec.ts`; misma sesión/origen, componentes existentes.
- AC-012-02/03/04: `tests/e2e/browser-flow.ts`; IndexedDB real, aborto, pestañas, cierre de navegador, acceso offline, siete días y recuperación de canje.
- AC-012-05: `tests/integration/loyalty.test.ts` y `tests/e2e/browser-flow.ts`; origen preservado, outbox exacto, retiro, destino único, respuesta interrumpida, reintento UI y reingreso offline del dueño.
- AC-012-06: `tests/sync.test.ts`, `tests/integration/pos.test.ts` y `tests/e2e/browser-flow.ts`; cursor causal central, prevención en perfiles vacíos, rechazo tipado, recuperación explícita con IndexedDB real y acuse antes de retirar pendientes.
- REQ-012-05: plan funcional, agents.md, arquitectura, DEC-021, specs/012, contratos browser-pos-v1, roadmap y README actualizados. [Revisión por área](../web-transition.md).

## Alcance de la transición de datos

La caja anterior de desarrollo se conserva íntegra. El dueño debe elegir el perfil de navegador que usará y pulsar **Trasladar caja anterior**; no se ha impuesto como destino el perfil temporal de pruebas. La interfaz pide contraseña cuando necesita preparar el verificador offline y solicita almacenamiento persistente también tras un traslado. El puente local de desarrollo verifica permisos, servicio anterior detenido, destino único y registra auditoría. No hay puente de archivos en el sitio alojado.

## Límites reales

Cerrar todas las pestañas suspende actividad; la cola se reanuda al abrir Caja/reconectar. La persistencia del navegador no protege frente a borrar el perfil/datos del sitio, pérdida del disco o JavaScript malicioso del mismo origen. Se solicita almacenamiento persistente sin prometer su concesión. No se ha dimensionado el agregado con volumen comercial real.

Instalación opcional como sitio/PWA mediante manifiesto; no se ensayó la instalación del acceso directo. Hardware USB, impresión/cajón, restauración operativa y publicación siguen pendientes. Nota posterior del 18-09-2026: DEC-009/GO-03 fueron descartadas y la fiscalidad externa no bloquea esta versión. Compras, informes/Excel y costo promedio corresponden al incremento 6.

No se realizó commit, despliegue, envío de mensajes ni migración comercial. El manifiesto [source-hashes.json](unified-web/source-hashes.json) identifica el estado del código entregado; se conservan los cambios previos de incrementos 2–5.
