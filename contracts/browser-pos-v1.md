# Contrato — Caja web v1

DEC-021; REQ-012-01 a 05, AC-012-01 a 05 y contratos comerciales vigentes de 004/005/006/007. Sustituye el adaptador de escritorio, no los cálculos ni el protocolo central.

## Sitio y sesión

Un origen: `/` Administración, `/caja` ventas/turnos/comprobantes/comandas. Autenticación online única mediante cookie HttpOnly/SameSite. Al iniciar sesión se prepara acceso de Caja en el mismo navegador cuando la vinculación y los permisos lo permiten; un problema de Caja no bloquea Administración. Caja conserva sesión local de doce horas y verificador PBKDF2-SHA256 (600.000 iteraciones, sal aleatoria) para usuarios ya validados. El primer perfil de Caja requiere conexión y activación por el dueño. Un navegador puede conservar un perfil aislado por terminal ya activada; la selección se hace online y sólo enumera terminales activas de sucursales autorizadas. Antes de cambiar, sincroniza y bloquea si existen pendientes, canje incierto o turno abierto; cada perfil conserva por separado su secuencia, pedidos, turnos, comprobantes y outbox, bajo la misma instalación de navegador. Otras pestañas del mismo origen comparten el perfil activo, instalación y sesión. Logout invalida sesión local y comunica el cierre a otras pestañas. Cambios remotos conocidos revocan acceso.

## Persistencia

AC-016-08: el estado de Caja deriva `orderNumbers` del historial completo del actor en el perfil (incluidos pedidos cerrados) y la venta virtual actual. El nombre editable de la pestaña reutiliza `OrderV2.label` y `order.save`, sin campos ni migración nuevos. Cerrar una pestaña usa `order.cancel`; conserva el pedido cerrado y su evento. Los pedidos vacíos se cierran sin confirmación; si la única venta es virtual, primero se guarda y después se cancela para conservar auditoría y avanzar su número. Una cancelación de otra pestaña conserva la selección; al cerrar la activa se selecciona una vecina abierta y, al cerrar la última, el estado crea una venta virtual nueva. No cambia la versión de IndexedDB ni la envoltura de sincronización.

IndexedDB `nativos-caja`, versión 1, almacén `state`. Agregado comercial cifrado AES-GCM con IV aleatorio de 96 bits y clave de 256 bits no exportable en el mismo almacén. No guardar contraseñas en claro ni credenciales en localStorage. El cifrado no representa aislamiento frente a JavaScript del mismo origen, extensiones privilegiadas o control del perfil. Clave y agregado se escriben juntos; pérdida de la clave impide recuperación local.

Cada comando toma Web Lock exclusivo `nativos-caja-writer`, vuelve a leer el agregado, comprueba sesión/concesión, revisión, turno y permisos, calcula con el dominio compartido y escribe la nueva versión en una sola transacción IndexedDB con durabilidad `strict`. Solo el evento complete confirma éxito al usuario. Abort/cuota conserva el estado anterior. Lecturas también pasan por el lock para evitar ver una intención intermedia. Clonar el agregado no representa commit. Segunda pestaña con revisión antigua recibe conflicto; misma operación/intención devuelve respuesta guardada.

Agregado incluye instalación, cursor secuencial, concesiones históricas, máximo temporal, snapshots sin costos, clientes, pedidos, turnos, ventas, devoluciones, eventos, movimientos, comandos idempotentes, outbox, fidelización e intención de canje. La versión incompatible bloquea sin borrar. Esquemas browser precompilados antes del build; CSP mantiene script-src self sin unsafe-eval.

## Sincronización y canje

Conservar `/api/pos/enroll`, `/authorize`, `/sync`, `/redemption/cancel` y payloadVersion 1/2/3. Hash SHA-256 sobre bytes UTF-8 exactos; firma Ed25519 verificada con Web Crypto. El servidor recalcula y valida actor, permiso, caja, secuencia, snapshots e importes. Acuse debe coincidir en todos los campos; una respuesta ajena no elimina pendientes. Conflictos visibles, no descarte automático.

La respuesta de autorización incluye `serverSequence` y `serverOperationId` como cursor causal inseparable. Un perfil sin outbox adopta un cursor central más avanzado antes de generar operaciones. Si una cola existente colisiona, se marca para conciliación y se bloquean nuevas escrituras. La acción explícita de conciliación puede reencadenar esa cola después del cursor central conservando IDs, payloads, hashes y concesiones; cada operación continúa pendiente hasta recibir su propio acuse exacto. No se reencadenan rechazos de contenido, permiso o versión como si fueran conflictos de secuencia.

Una venta conservada por el rechazo histórico y contrario a REQ-003-03 de existencias insuficientes ofrece un reintento explícito. Solo aplica a payloads `sale.charge` o `sale.split` y al código `insufficient_stock`/`stock_insufficient` o su mensaje histórico. El reintento no altera `operationId`, secuencia, predecesor, payload, hash ni concesión; vuelve a usar `/api/pos/sync` y solo retira la entrada tras un acuse exacto. Si el servidor vuelve a rechazar, se conserva en conciliación y no se reintenta automáticamente.

Una operación conservada con `grant_denied` por la antigua comparación estricta entre reloj del navegador y reloj central también ofrece un reintento explícito cuando contiene `occurredAtMs`. El servidor aplica la misma tolerancia máxima de cinco segundos usada por la autorización local; el reintento conserva íntegros operación, payload y concesión, y cualquier rechazo distinto vuelve a conciliación.

Canje: vaciar outbox, validar saldo/regla central, guardar intención, enviar transacción central y aplicar resultado local atómicamente con retirada de intención. Acuse perdido conserva intención; reinicio la muestra. Cancelación antes del commit impide mensaje tardío; después recupera la venta. Durante incertidumbre se bloquean nuevas escrituras comerciales. Acumulación offline pendiente y devoluciones proporcionales conservan contrato loyalty-v1.

## Shell offline y actualización

Service worker precarga solo HTML/JS/CSS del sitio. Nunca intercepta/cachea API, credenciales, informes o costos. Navegación offline recupera `/` y `/caja`; Administración informa falta de conexión y permite abrir Caja. Cachés por versión, sin skipWaiting forzado; no borrar IndexedDB ni cambiar código de una pestaña durante un cobro. La sincronización ocurre con Caja abierta, cada 15 segundos cuando no se está editando, y manualmente; tras cerrar todas las pestañas se reanuda al abrir. No depender de Background Sync.

Solicitar StorageManager.persist al vincular. El navegador puede denegarlo; no garantiza recuperación frente a limpieza manual del sitio, cambio de origen/perfil o pérdida del disco. HTTPS necesario salvo loopback de desarrollo. Edge/Chrome actuales constituyen el objetivo inicial probado.

## Traslado local anterior

Solo servidor de desarrollo habilita `/api/local-transition` GET y POST `{targetId:UUID}` para dueño autorizado. Rechaza traslado si el servicio antiguo sigue escuchando. Conserva installationId, terminal, cursor, snapshots, pedidos, turnos, ventas/comprobantes, devoluciones, outbox y canje incierto. No traduce verificadores scrypt de Windows: acceso posterior online prepara PBKDF2. Registra auditoría y fija destino único en SQLite, bloqueando escrituras/sync del motor antiguo. Reintento del mismo target conserva la respuesta; otro destino se rechaza. La fuente permanece y no se ofrece borrar ni reemplazar una caja con datos. Navegador persiste su target antes de pedir datos y el agregado completo antes de utilizarlo. Si se pierde el perfil después del traslado, corresponde conciliación explícita; no habilitar otro escritor automáticamente.

No hay puente de lectura de archivos en producción. Impresión silenciosa, cajón y restauración operativa siguen pendientes de ensayo real desde navegador.

Referencias técnicas: [transacciones IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction), [importación de claves Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey).
