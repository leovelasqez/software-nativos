# Evidencia — Incremento 5: fidelización

Fecha de cierre: 15-09-2026. Implementación local autorizada por el usuario y retomada tras agotarse los tokens. Estado: verificado en su alcance; sin publicación ni operaciones reales en Alegra.

## Resultado

Inscripción online vinculada al cliente, saldo confirmado global e historial por sucursal, acumulación offline pendiente y canje online. Ajustes y nuevas versiones de reglas exclusivos del dueño con motivo/auditoría. Comprobante conserva regla, canje, puntos ganados y saldo conocido al preparar el cobro; no representa ese saldo histórico como saldo actual. Devoluciones restituyen puntos usados y dinero pagado, y revierten puntos ganados; admiten saldo negativo sin bloquear compras. Sin acumulación retroactiva de ventas v1/v2 o anteriores a inscripción.

Canje con intención durable SQLite y confirmación central de venta, puntos, inventario y caja en la misma transacción. Recuperación idempotente ante respuesta perdida/reinicio. Cancelar antes del commit crea un registro que bloquea mensajes tardíos; después del commit recupera el comprobante. Mientras el resultado es incierto, no permite otros cobros en esa caja.

## Verificación ejecutada

| Comando / comprobación | Resultado |
| --- | --- |
| `npm run check` | TypeScript correcto, 33 pruebas de dominio/políticas, 45 pruebas de integración (incluyen 5 pruebas padre), compilación Vite correcta |
| `node --test tests/integration/loyalty.test.ts` | Repetición focalizada después de exigir motivo no vacío en cambios de reglas: 8/8 correctas (7 escenarios y padre) |
| `npm run typecheck` | Correcto tras el último ajuste del servidor |
| `npm run test:e2e` | 1 flujo integrado correcto, 1,8 minutos: fundamentos, catálogo, caja, pedidos y fidelización; Edge y Electron |
| Accesibilidad / interfaz | Axe sin infracciones en los estados evaluados, teclado y foco, escritorio 1440×1000 y móvil 390×844, claro/oscuro, sin desborde horizontal en directorio |
| Migraciones | SHA-256 de SQL 001–004 idéntico al manifiesto del incremento 4; 005 aditiva y caché/intención SQLite con checksum independiente |
| Arranque local | `scripts/start-local.ps1` completado; Administración 4310 y Caja 4311 responden HTTP 200 y renderizan h1 en Edge sin pageerror |
| Estado conservado | `/api/status`: setupRequired=false; POS: enrolled=true, online=true. No se reinició la configuración ni se introdujeron clientes/ventas de prueba en desarrollo |
| `git diff --check` | Correcto |

Las pruebas usan PostgreSQL, SQLite y DPAPI reales con datos sintéticos separados de `.local/development` y `.local/pos`. No se usan mocks como prueba de persistencia. Los fallos de red se inyectan antes del commit y después de confirmarlo. La carrera usa dos instalaciones de Milán/Centro contra el mismo saldo; se comprueba un solo canje exitoso. Se valida también regla histórica offline, compra con saldo negativo, reintentos de devolución y devolución de solo puntos sin dinero.

## Trazabilidad

- AC-005-01/05 y REQ-005-06: `tests/integration/loyalty.test.ts`; inscripción única, permisos, ajustes idempotentes y versiones de regla.
- AC-005-02/07/08 y AC-004-06/07: `tests/loyalty.test.ts`; cálculo exacto, exclusión de propina/envío, reparto y devolución acumulada.
- AC-005-03/04/06 y REQ-007-01/02: integración de fidelización con dos motores POS; offline, reinicio, carrera, recuperación y cancelación serializada.
- REQ-001-05 / REQ-005-03: `tests/e2e/loyalty-flow.ts`, invocado por `foundation.spec.ts`; inscripción, ajuste, canje, comprobante, devolución, historia y cambio de regla.
- Regresiones anteriores: suites de fundamentos, catálogo, pedidos y caja; capturas nuevas bajo `increment-5/regression`, sin sobrescribir evidencia de incremento 4.

## Revisión visual

Capturas inspeccionadas: [directorio claro](increment-5/desktop-light-loyalty.png), [directorio móvil oscuro](increment-5/mobile-dark-loyalty.png), [canje](increment-5/desktop-redemption.png), [comprobante](increment-5/desktop-points-receipt.png), [devolución móvil](increment-5/mobile-points-refund.png) e [historia](increment-5/desktop-points-history.png). Texto legible y controles utilizables; los formularios largos desplazan su contenido dentro del diálogo.

Durante la implementación se corrigieron registro de rutas, recuperación de caché tras reinicio, comparación explícita de campos del acuse, devolución con dinero cero y conservación del formulario ante errores normales de pago. El último ajuste rechaza motivos de reglas compuestos solo por espacios; integración focalizada y TypeScript repetidos después.

## Límites

El régimen inicial no vence puntos; no hay configuración de vencimientos. Excel, compras, traslados, conteos, costo promedio y respaldos operativos corresponden al incremento 6. Impresión física, instalador y lanzamiento siguen pendientes. La verificación local no acredita producción, cobros bancarios reales, hardware ni recuperación ante pérdida total del disco.

Manifiesto del estado local: [source-hashes.json](increment-5/source-hashes.json). Se preservan los cambios previos de incrementos 2–4; no se realizó commit ni despliegue.
