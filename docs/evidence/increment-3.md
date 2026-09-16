# Evidencia — Incremento 3: primera venta completa

Fecha: 14-09-2026, America/Bogota. Autorización: «Continúa con el incremento 3». Alcance local de la hoja de ruta, sin publicación ni datos comerciales de prueba en desarrollo.

## Entrega

Caja React en servicio Node/SQLite independiente del servidor central y ventana Electron. Apertura de turno con responsable/base, pedido persistente a Consumidor final, terminados/preparados con adicionales/sustituciones, cantidad y precio/receta/impuesto congelados por línea. Un medio de pago manual por pedido completo: efectivo con cambio o digital exacto. Venta, recibo, consumo, efectivo, outbox y respuesta idempotente comparten commit SQLite. Guardar un pedido no descuenta inventario; cobrar puede dejar negativo con alerta.

Cierre con contado/esperado/diferencia, consulta de últimos 50 comprobantes y copia sin cobrar de nuevo. Alta online de producto conserva las líneas existentes. Inventario central muestra consumos de venta. API de ventas central paginada por ID y alcance de sucursal.

Grant Ed25519 de siete días; token/verificador scrypt/concesiones/reloj custodiados con DPAPI, fuera del renderizador y SQLite. El caché público no incluye costos ni siquiera para dueño. Concesiones históricas se conservan por grantId para el outbox. Expiración/reloj regresivo bloquean cobro/apertura; recuperación autorizada permite consulta, guardar pedido y cerrar. Revocación conocida bloquea nuevas acciones; ventas históricas aceptadas de usuario revocado quedan marcadas para revisión; equipo revocado conserva pendientes en conciliación.

Sincronización secuencial cada 15 segundos o manual. Servidor verifica firma, ámbito, bytes/hash, precedencia y snapshots; recalcula el mismo comprobante y confirma efecto/auditoría/acuse en una transacción PostgreSQL. Acuse inválido no limpia cola; reintento idéntico no duplica. Snapshot nuevo se aplica completo después de vaciar pendientes. Saldo local evita descontar nuevamente efectos ya incluidos en la secuencia central.

## Pruebas

- `npm.cmd run check`: TypeScript, 24 pruebas de dominio, suites de fundamentos/catálogo/caja y build aprobados. La ejecución completa contó 29 resultados de integración incluyendo tres suites padre (26 escenarios).
- Después de ampliar la prueba de reinicio/fallo central, `npm.cmd run typecheck` y `node --test tests/integration/pos.test.ts`: aprobados; caja ahora contiene 8 escenarios más su suite padre (9 resultados, 96,98 s). Sumados a los 19 escenarios de fundamentos/catálogo: 27 escenarios de integración, no 30 pruebas independientes.
- `npm.cmd run test:e2e`: flujo de fundamentos/catálogo extendido con apertura, pedido preparado/opción, recarga, pago insuficiente rechazado, cobro, recibo/copia, sincronización y cierre. Electron real abre la misma caja e historia; renderer sin globals require/process. Última ejecución aprobada: 1 flujo completo, 1,7 minutos de prueba y 2,3 minutos total, sin pruebas omitidas.
- PostgreSQL y SQLite reales, no motores en memoria. DPAPI Windows real, contraseñas sintéticas aleatorias solo en memoria. El transporte de integración adapta HTTP Fastify mediante inject; E2E usa HTTP real entre ambos servicios y Edge/Electron.

## Fallos y recuperación comprobados

| Caso | Resultado observado |
| --- | --- |
| Fallo antes de commit SQLite | Sin venta/caja/stock/outbox parcial; pedido intacto |
| Cierre/reapertura del servicio/SQLite y custodia | Pedido o venta/turno/pendientes recuperados; contraseña offline verificada |
| Fallo central antes de insertar acuse | La transacción revierte también el turno; pendiente local reintenta |
| Respuesta perdida después del commit central | Reintento devuelve acuse; una venta y consumo único |
| Reinicio PostgreSQL/servidor central | Migración repetible, recibos y saldos conservados |
| Catálogo cambia y se crea producto durante pedido | Líneas anteriores conservan precio; nuevas usan la nueva versión |
| Pago digital | No aumenta el efectivo esperado; excedente rechazado |
| Hash, firma, ámbito o secuencia alterados | Rechazo sin aplicar efectos; acuse ajeno no marca confirmado |
| Usuario revocado tras vender offline | Historia sincronizada con revisión; nuevos accesos bloqueados |
| Equipo revocado con cierre pendiente | Conserva outbox y error de conciliación |
| Reloj atrás / siete días transcurridos | Cobro bloqueado, consulta/pedido/cierre preservados; reinicio mantiene restricción |

La expiración se verifica con reloj inyectado, sin cambiar Windows. El cierre creado en el futuro simulado se conserva localmente; no se presenta como siete días reales transcurridos. Reinicios son de procesos/motores, no corte físico de energía ni fallo total del disco.

## Interfaz y operación local

Capturas en [increment-3](increment-3/): venta escritorio/móvil claro/oscuro, comprobante móvil, Electron y login local. Axe sin infracciones en las cuatro vistas de venta y el comprobante evaluados (WCAG 2 A/AA y 2.1 AA). Teclado/foco/escape y ausencia de desbordamiento en 1440×1000 y 390×844. Regresión de incrementos anteriores se guarda bajo increment-3/regression, preservando sus capturas originales.

Se corrigió una carrera del test de navegación: después de recargar se espera el contenedor del menú React antes de decidir si está plegado y luego se selecciona su botón visible, sin incluir iconos ocultos en el nombre accesible. Una creación simultánea de clúster de prueba agotó el timeout durante sincronización de archivos; se repitió de forma aislada sin desactivar durabilidad ni cambiar datos. No se ocultaron pruebas fallidas/omitidas.

Desarrollo responde en http://127.0.0.1:4310 y caja en http://127.0.0.1:4311. Migración 003 aplicada preservando el clúster existente. La configuración del dueño ya existe (status setupRequired=false); caja permanece sin vincular (enrolled=false). No se creó ni modificó cuenta, producto o venta de desarrollo para probar. Arranque de procesos ocultos persistentes mediante scripts/start-local.ps1; PostgreSQL existente del mismo directorio se reutiliza tras caída del proceso Node. Validación visual del login local con agent-browser.

## Límites del incremento

Solo primera venta completa. No se implementaron mesas/comandas, pagos combinados/división, descuentos, propina/envío, clientes distintos de Consumidor final, cancelación/devolución, puntos, ingresos/salidas manuales, compras/costos promedio, conciliación editable ni reemplazo automático de equipo. Esos alcances permanecen en incrementos posteriores.

Comprobante interno, sin integración fiscal o bancaria. Impresión USB, instalador/Node empaquetado, firma de distribución, autoarranque Windows, respaldo/restauración operativa, pérdida del disco, WhatsApp/Alegra y publicación siguen pendientes. No se afirma resistencia contra el administrador del equipo o base. Cerrar Electron mantiene activo el servicio POS; tras reiniciar Windows se ejecuta nuevamente el lanzador.

## Trazabilidad e identidad

Planes/tareas 004/006/007 y DEC-018 precedieron al código. Contratos pos-v1.md y pos-*.json; src/pos-domain.ts, pos-crypto.ts, src/pos/, src/server/pos-api.ts, migración 003, web/Pos.tsx y desktop/main.cjs. AC-004-11/12, AC-006-05 y AC-007-07 verificados en el alcance descrito. No se acreditan íntegramente las specs 004/006/007.

Dependencia añadida: Electron 44.3.0 fijado en lockfile; runtime Node 24.15.0, PostgreSQL 18.4, SQLite nativo. Manifest de hashes en increment-3/source-hashes.json; trabajo local sin commit nuevo. Los cambios previos del incremento 2 se conservaron.
