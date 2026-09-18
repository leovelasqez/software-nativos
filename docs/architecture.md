# Arquitectura propuesta

Estado: transición al sitio web único autorizada el 15-09-2026 (DEC-021). Los apartados de incrementos 0–5 son historia de la implementación anterior.

## Arquitectura vigente

Un sitio React/TypeScript y API modular Node/PostgreSQL. Administración en `/`, Caja en `/caja`, misma cookie de sesión y navegación. El navegador guarda Caja en IndexedDB con transacciones estrictas y Web Locks entre pestañas. Web Crypto verifica las concesiones Ed25519 centrales y cifra el agregado con AES-GCM y clave no exportable; verificador offline PBKDF2 con sal por usuario. Esta custodia no equivale a DPAPI ni protege ante control total del perfil o JavaScript del mismo origen.

El service worker precarga solamente HTML/JS/CSS públicos; las respuestas API, sesiones y costos no se cachean. Actualizaciones esperan al cierre de clientes; no borran IndexedDB. La cola conserva protocolo v1/v2/v3 y un acuse exacto. Sin conexión se recupera el sitio en el mismo origen/perfil; administración y canje siguen online. El sitio cerrado no garantiza sincronización en segundo plano.

Los dominios `catalog.ts`, `orders-domain.ts`, `loyalty.ts`, las políticas y el servidor central se reutilizan. Validadores de esquema se generan durante build para evitar eval en el navegador. El agregado inicial facilita atomicidad; no se ha dimensionado con volumen comercial real y deberá medirse antes de lanzamiento.

SQLite/DPAPI/Electron permanecen como adaptadores históricos, sin dependencia Electron en el producto. El puente local de desarrollo traslada una instalación a un único navegador preservando IDs, secuencia, pedidos, turnos, comprobantes, outbox y canje incierto. Bloquea otro destino y retira el escritor anterior; no borra la fuente. No existe este puente de archivos en el servidor alojado. Plan y pruebas: [012](../specs/012-unified-web/plan.md).

## Responsabilidades

| Área | Es responsable de | No debe hacer |
| --- | --- | --- |
| Identidad y sucursales | Usuarios, permisos, equipos y acceso offline | Confiar solo en controles visuales |
| Catálogo y recetas | Presentaciones, precios, versiones y conversiones | Cambiar una receta histórica de una venta |
| Pedidos y ventas | Pedido, descuentos, pago, comprobante y devoluciones | Escribir saldos sin movimientos trazables |
| Inventario y compras | Movimientos, existencias, costos y traslados | Tratar costo desconocido como cero |
| Caja | Turnos y movimientos por medio de pago | Mezclar cobro digital con efectivo disponible |
| Fidelización | Libro de puntos, reglas y reservas/canjes | Aceptar canjes offline |
| Sincronización | Cola local, acuses, versiones y reconciliación | Descartar pendientes antes del acuse |
| Informes | Consultas y exportaciones autorizadas | Recalcular operaciones históricas con reglas actuales |
| Integraciones | WhatsApp, importación Alegra y MCP | Saltarse reglas del dominio |

## Datos y consistencia

- La caja confirma localmente la transacción que contiene venta, pagos, consumo y caja. El diseño deberá precisar cómo se coordina el canje online de puntos con esa transacción local.
- La sincronización usa identificadores estables, control de repetición y acuses. El objetivo comprobable es un solo efecto comercial por operación, incluso con múltiples entregas.
- El servidor conserva la vista consolidada y el estado de actualización de cada local. Los reportes no ocultan la antigüedad de los datos.
- Precios, impuestos, receta, sustituciones y reglas aplicadas se conservan con la operación; su representación exacta se definirá en los contratos.
- Los datos de costo no deben llegar a usuarios no autorizados. Límite definido en DEC-004/015: costeo central y proyecciones públicas sin costos en caché POS; integración por implementar.
- La consulta y el cobro no dependerán de la disponibilidad de WhatsApp. Los envíos se procesan a partir de operaciones comerciales confirmadas.

## Contratos que deben existir antes del código dependiente

1. Identidad: actor, equipo, sucursal, permisos y validez offline.
2. Catálogo: producto, presentación, receta/versiones, unidades, sustituciones y precios.
3. Venta: líneas, descuentos, impuestos, propina, envío, pagos, comprobante, devolución y vínculo con turno.
4. Inventario: tipos de movimiento, unidad base, bodega y referencia de origen.
5. Puntos: acumulación, canje, reserva/confirmación/cancelación y devolución.
6. Sincronización: operación, orden causal, versión, acuse, reintento, errores y conflictos.
7. Exportación y trabajos externos: filtros, permisos, estado y acceso al resultado.

Crear contratos OpenAPI para la API y esquemas versionados para datos/eventos de sincronización cuando se refine cada interfaz. Los adaptadores MCP deben reutilizarlos. No fijar endpoints o campos arbitrarios antes de resolver las transacciones que representan.

## Seguridad y operación

Definir manejo de credenciales, almacenamiento protegido de autorizaciones offline, revocación al reconectar y separación de permisos. Un usuario con acceso al archivo de la caja no debe obtener costos que el producto le prohíbe consultar mediante una simple exportación del caché.

Registrar métricas y errores por operación con datos personales mínimos. Diseñar respaldo, restauración, actualización de esquema local y compatibilidad temporal entre clientes y servidor. No actualizar una caja de forma que pierda operaciones aún no sincronizadas.

Railway fue elegido como alojamiento y desplegado el 18-09-2026. El sitio único corre como servicio Node/Fastify con PostgreSQL en la red privada de Railway; `DATABASE_URL`, dominio y puerto se reciben como variables externas. La aplicación y la base tienen una sola réplica en la misma región. PITR está habilitado y conectado a almacenamiento; presupuesto, capacidad medida, restauración aislada, retención y objetivos de recuperación continúan pendientes.

## Implementación local del incremento 0

`src/contracts.ts` valida esquemas y restricciones semánticas. `src/authorization.ts` evalúa permisos y proyección pública. `src/sync.ts` verifica acuses y transiciones sin almacenamiento. `tests/` prueba únicamente esos límites. Ninguno autentica, abre sockets, cobra ni persiste datos. Adaptadores de API, caja y exportaciones deberán consumir estas políticas y añadir pruebas de integración.

## Implementación local del incremento 1

Fastify aplica el contrato OpenAPI `contracts/foundation-api-v1.json`, resuelve sesiones en PostgreSQL y reutiliza permisos. UI React/Vite en web/, servida desde el mismo origen. src/server/db.ts contiene migración/tx/auditoría; security.ts contraseñas/sesiones. Migraciones SQL mantienen checksum y lock. Las mutaciones administrativas revalidan sesión dentro del lock transaccional.

El helper scripts/local-postgres.ts usa binarios PostgreSQL reales fijados por npm, loopback y credencial DPAPI. No es motor en memoria ni sustituto de PostgreSQL. Desarrollo en .local/development, pruebas aisladas. scripts/e2e-teardown.ts cierra explícitamente el clúster sintético al finalizar en Windows. No hay instalador ni despliegue central.

El renderizador web solo almacena preferencia de tema en localStorage; sesiones en cookie HttpOnly y datos de respuesta con no-store. No se descargan costos, passwords ni hashes. La información de equipo de sesión web es una identidad generada para auditoría, distinta del equipo físico POS. Las claves/firma de concesiones offline y la custodia del POS siguen pendientes.

## Implementación local del incremento 2

src/catalog.ts comparte decimales exactos y reglas de activación/consumo previsto; src/server/catalog-api.ts incorpora catálogo, versiones, artículos, libro de iniciales/reversiones, mínimos y costos aislados al mismo servidor. Migración 002 aditiva; contracts/catalog-inventory-v1.json consumido por validación/serialización y pruebas. web/Catalog.tsx contiene formularios conectados para productos, recetas e inventario. DEC-017 detalla límites y recuperación comprobada. Sin adaptador POS ni ventas todavía.


## Implementación local del incremento 3

Servidor central Fastify/PostgreSQL conserva snapshots públicos, concesiones Ed25519 y operaciones confirmadas con acuse único. Migración 003 añade ventas/turnos/instalaciones y consumos al libro existente. SQLite en un servicio Node 24 separado en loopback conserva pedido, turno, venta, efectivo, consumo y outbox atómicos; grantId refiere a la custodia DPAPI. El renderizador React no recibe tokens/verificadores/firmas/costos ni acceso directo al motor.

Electron 44.3.0 carga la interfaz de caja en 4311, con sandbox/contextIsolation y sin nodeIntegration; deniega navegación externa, ventanas nuevas y permisos. El lanzador inicia servidor central (4310), PostgreSQL (54329) y servicio POS (4311) como procesos ocultos persistentes. El servicio POS sigue funcionando si se cierra la ventana; la cola se intenta enviar cada 15 segundos. La primera vinculación requiere dueño online y solo admite una instalación por equipo; un reemplazo no borra pendientes automáticamente.

Consulta de comprobante es de solo lectura. Un acuse incorrecto no limpia el outbox. Error de transporte reintenta; conflicto queda para conciliación. Revocación conocida bloquea nuevas acciones y conserva historia. Ante expiración se permite consulta, guardar pedido y cerrar turno. No hay instalador/actualización automática, impresión física ni restauración operativa del disco: alcances posteriores. Ver contracts/pos-v1.md y evidencia incremento 3.


## Evolución de pedidos del incremento 4

Pedidos v2 y clientes se añaden sobre la instalación y la secuencia del POS existente. src/orders-domain.ts comparte reglas puras entre caja/central/interfaz; pos-contract.ts y orders-contract.ts compilan esquemas solo en el servidor/motor local, preservando CSP estricta del navegador. orders-store.ts agrega tablas SQLite con checksum independiente; migración PostgreSQL 004 conserva las anteriores. Un comando confirma pedido, venta/devolución, movimiento, auditoría y outbox en una misma transacción. Datos previos y comprobantes v1 siguen disponibles, y las concesiones antiguas no se amplían implícitamente.

## Fidelización del incremento 5

Dominio puro src/loyalty.ts y orders-domain.ts; esquema orders-v3 compilado fuera del navegador. Migración 005 añade miembros, versiones inmutables de reglas, libro de puntos y cancelaciones. Acumulación offline usa caché explícita sin costos y confirma con la venta al sincronizar. Canje confirma centralmente venta, puntos y movimientos bajo lock compartido, con intención persistida en SQLite antes de enviar. Acuse exacto permite aplicar localmente la misma operación y retirar intención atómicamente. La cancelación central impide mensajes tardíos; si ya confirmó, recupera el comprobante. DEC-020 y contracts/loyalty-v1.md detallan protocolo y límites.
