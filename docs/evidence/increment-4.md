# Evidencia — Incremento 4

Fecha: 14-09-2026, America/Bogota. Implementación local autorizada. Datos sintéticos en bases aisladas; sin operaciones comerciales reales ni cambios en Alegra.

## Resultado

Pedidos persistentes múltiples por responsable, mostrador/mesa/domicilio, cliente sincronizado o alta online, notas/opciones/descuentos por línea sin alterar catálogo. Cada selección cobrada conserva su cliente, comprobante, importes y versiones, y deja pendiente el resto. Pagos combinados manuales, propina y domicilio separados; cambio únicamente de efectivo.

Comandas internas con cantidades nuevas identificadas; no consumen. Cancelaciones registran motivo, cantidad y unidades preparadas como desperdicio único. Devoluciones con permiso sale.refund y turno propio: cantidades, propina y domicilio seleccionables hasta sus saldos pagados no devueltos. Solo terminados recuperables vuelven al inventario; preparados no restauran ingredientes ni duplican consumo. El original permanece inmutable. Resumen de turno incluye todos sus cobros/devoluciones, separando propina y domicilio netos.

Administración permite alta/búsqueda de clientes y consulta paginada de cobros/devoluciones sincronizados de la sucursal autorizada. El directorio es compartido; la historia identifica su alcance y no presenta pendientes remotos como datos completos.

## Comprobaciones

- Dominio: descuentos, cantidades divididas, medios combinados, cambio, comanda, desperdicio, restitución acumulada y redondeo exacto por componentes. Prueba adicional de autorización: devolución de dueño/encargado bloqueada al expirar o retroceder reloj; cajero sin permiso por defecto.
- Integración: PostgreSQL real, SQLite nativo y DPAPI Windows; cliente único y alta de cajero, pedido preservado, transacción revertida antes de commit, comanda sin consumo, cancelación preparada, cobro offline parcial y reinicio, doble clic idempotente, acuse perdido tras commit y reintento, equivalencia de estado central/local, cobro restante, devolución mixta, cierre conciliado, historia por sucursal con denegación fuera de alcance y migración de pedido v1 preservando identidad.
- Regresión de incrementos 1–3: identidad, permisos, catálogo/recetas/versiones, inventario/costos, firma/custodia, rollback, reinicios, expiración, secuencia y revocación. Clústeres de integración secuenciales para evitar contención de inicialización en Windows.
- E2E completo Edge + Electron aprobado: 1 recorrido integrado (1,3 minutos). Configuración/roles/catálogo, caja previa, nuevo cliente, domicilio, mesa, cambio entre pedidos, notas/descuento, comanda, cancelación preparada, cobro parcial con efectivo y Nequi, comprobante, recarga, devolución de propina/domicilio, sincronización, turno e historia del cliente.
- Axe sin infracciones WCAG 2 A/AA y 2.1 AA en las vistas evaluadas: venta claro/oscuro en escritorio y móvil, comprobante, devolución e historia móvil, además de la regresión administrativa. Teclado/foco/Escape; sin desbordamiento horizontal en 1440×1000 y 390×844. Capturas revisadas de venta, comprobante, devolución y cliente; formularios largos tienen desplazamiento interno.

Resultado final: npm run check aprobado (TypeScript, 29 pruebas de dominio/política, 37 comprobaciones de integración incluyendo sus 4 suites y build Vite). npm run test:e2e aprobado. Sin pruebas omitidas ni fallidas en las ejecuciones finales. git diff --check sin errores.

## Correcciones halladas durante E2E

La compilación AJV no pertenece al navegador con CSP estricta. Se separó en pos-contract.ts y orders-contract.ts para validar en el servidor y motor local; los cálculos puros se comparten sin eval y se conservó script-src self. También se bloqueó editar/seleccionar otro pedido mientras termina su creación para evitar aplicar metadatos al pedido anterior por una interacción rápida. El test espera explícitamente el nuevo pedido vacío. Los recorridos fallidos se corrigieron y la repetición completa pasó, sin omitir verificaciones.

## Operación y límites

Administración y Caja reiniciadas en 4310/4311; comprobada carga sin errores JavaScript. Migración PostgreSQL 004 y migración SQLite aditiva con checksum propio. Se preservan 001–003, el outbox v1, comprobantes y configuración del usuario. Las pruebas no incorporaron clientes, productos ni ventas a desarrollo. Estado consultado: setupRequired=false y enrolled=false. Hashes de las migraciones 001–003 iguales a los registrados en la evidencia del incremento 3.

Concesión offline sale.refund vigente, máximo siete días; una autorización antigua sin esa acción requiere validación online. Se conservan pedidos, cierres y pendientes después de expirar. No se modificó el reloj del sistema. Reinicios de procesos no acreditan corte físico de energía, recuperación de disco ni operación en producción.

Fidelización/canje/reversión de puntos: incremento 5. Ingresos/gastos/retiros manuales, compras, costos promedio, exportación y respaldo operativo: incremento 6. Impresión USB física, hardware, instalador, emisión fiscal, mensajería, integraciones y lanzamiento siguen pendientes. Comprobantes y comandas son internos; los medios de pago no están integrados con bancos. El estado manual de domicilio se edita en el pedido pendiente; no hay seguimiento de reparto posterior al cierre del pedido.

## Trazabilidad

Planes/tareas increment-4 de 004/005/006/007; DEC-019 y respuesta del usuario que permite devolver propina/domicilio. Contratos orders-v2 y customers-v1, envoltura sync v1 con payloadVersion 1 o 2. Pruebas: tests/orders.test.ts, tests/authorization.test.ts, tests/integration/orders.test.ts, tests/e2e/pos-flow.ts y regresiones. REQ-005-01; REQ-005-02 parcial (datos manuales del pedido); AC-004-01/02/03/04/08/09/10; REQ-004-05/06 en su alcance sin puntos ni emisión fiscal; REQ-006-02/03 en cobros/devoluciones/cierre; REQ-007-01/02 en persistencia y causalidad. No se acreditan las specs completas.

Capturas en increment-4/, regresiones bajo increment-4/regression/. Se preservó evidencia de incrementos anteriores. Manifest SHA-256 del código y contratos finales en increment-4/source-hashes.json; cambios locales sin crear commit.
