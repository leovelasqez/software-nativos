# Evidencia — Incremento 6 (en curso)

Fecha: 15-09-2026. Esta evidencia acredita únicamente la primera vertical de compras y proveedores; no declara completo el incremento 6.

## Entregado en esta fase

- Migración aditiva `006-purchases.sql`: proveedores, compras, líneas y movimientos de entrada `purchase`, sin modificar migraciones 001–005.
- API online autenticada para crear/listar proveedores y registrar/listar compras por sucursal. Cada compra valida cantidades/conversión, coincide exactamente con el importe pagado, conserva respuesta idempotente y deja auditoría junto con los movimientos.
- Traslados: un borrador identifica origen, destino y líneas; despacho registra una sola salida y las recepciones parciales solo agregan lo pendiente. Eventos y líneas permanecen inmutables; un reintento conserva su respuesta y una recepción que excede lo despachado se rechaza.
- Conteos físicos: cada línea conserva saldo esperado, cantidad contada y diferencia; una diferencia positiva/negativa genera una única entrada/salida de ajuste causal. Los decimales negativos se representan de forma segura sin intentar validarlos como una entrada positiva.
- Administración: las pantallas Traslados y Conteos y ajustes permiten completar los flujos anteriores. La E2E despacha y recibe parcialmente un traslado sintético, luego registra un conteo sobre saldo negativo que genera el ajuste correspondiente.
- Consumo interno: API y formulario administrativo registran una salida separada de desperdicio; se cubre por integración y por el flujo E2E sintético.
- Caja: ingresos, gastos, retiros y correcciones causales se registran online dentro de la cadena del turno. El libro inmutable conserva medio, importe, actor y motivo; solo efectivo altera lo esperado. La integración aislada verifica ingreso de COP 386.000, retiro de COP 50.000, contrapartida, medio digital, reintento y cierre conciliado en COP 536.000.
- Encargado puede registrar/consultar las compras de su sucursal; cajero recibe 403. La compra no calcula ni expone costo promedio, margen ni costo de receta: DEC-005 continúa pendiente.
- Administración incluye **Compras y proveedores**, formularios de proveedor/compra y listado de entradas. La fecha se transporta como fecha local explícita, evitando conversiones de timestamp que alteren o rompan el renderizado.
- Informes: consultas autorizadas de ventas, caja, inventario, compras, desperdicio y fidelización por sucursal y período; ventas filtra también producto, cliente y medio, compras proveedor/medio, y desperdicio/fidelización sus identidades pertinentes. Las devoluciones se presentan separadas y concilian productos, descuentos, canje, propina, domicilio, efectivo y digitales. Cada respuesta y XLSX usa una instantánea PostgreSQL `REPEATABLE READ READ ONLY`, evitando mezclar filas y totales de operaciones concurrentes. La pantalla presenta última sincronización, paginación y exportación XLSX con hojas de contexto, datos y totales. La integración valida 120 filas frente a una página de 20 y que el archivo descargado contiene la totalidad de datos.
- Respaldo local: el dueño puede crear, listar y verificar un respaldo lógico de los hechos sincronizados desde Administración. Cada manifiesto conserva versión de esquema, checksum SHA-256, tamaño y cobertura explícita; crear/verificar queda auditado. El ensayo exige la confirmación exacta, crea una base sintética nueva, migra, restaura y concilia los conteos; rechaza cualquier destino existente y nunca modifica la base activa. No cubre IndexedDB ni operaciones sin acuse.

## Verificación ejecutada

| Comando / escenario | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 tests/integration/catalog.test.ts` | 12/12: incluye AC-003-09, 1 kg → 1.000 g, AC-003-10 con recepción parcial/reintento/límite, AC-003-11 con ajuste causal, permisos, auditoría, reinicio y restauración sintética. |
| `npm.cmd run typecheck` | Correcto. |
| `npm.cmd run build` | Correcto. |
| `npm.cmd run test:e2e` | Correcto en Edge con base y perfil sintéticos aislados; crea proveedor/compra, traslado/despacho/recepción parcial, conteo/ajuste y respaldo lógico desde Administración. |
| `node --test tests/integration/reports.test.ts` | Correcto: autorización, paginación 120/20 y XLSX válido con las 120 filas. |
| `node --test --test-name-pattern "AC-008-02" tests/integration/reports.test.ts` | Correcto: filtros de producto/cliente/medio, devolución con totales separados y conciliados, y cajero autorizado sin costos/márgenes en pantalla ni XLSX. |
| `npm.cmd run test:e2e` (Informes) | Correcto: abre la pantalla desde navegación móvil y descarga el XLSX de ventas. |
| `node --test tests/integration/backup.test.ts` | Correcto: crea/lista/verifica, exige confirmación, restaura y concilia una base aislada, rechaza repetir el destino y detecta un artefacto alterado. |
| `git diff --check` | Correcto. |

## Límites pendientes

La política de retención, ubicación externa, RPO y RTO sigue bloqueada por DEC-012. Costeo promedio, valoración de negativos/entradas tardías y márgenes siguen bloqueados por DEC-005. No se alteraron datos comerciales, Alegra, producción ni respaldos reales.
