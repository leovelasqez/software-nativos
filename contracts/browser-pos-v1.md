# Contrato — Caja web v1

DEC-021; REQ-012-01 a 05, AC-012-01 a 05 y contratos comerciales vigentes de 004/005/006/007. Sustituye el adaptador de escritorio, no los cálculos ni el protocolo central.

## Sitio y sesión

Un origen: `/` Administración, `/caja` ventas/turnos/comprobantes/comandas. Autenticación online única mediante cookie HttpOnly/SameSite. Al iniciar sesión se prepara acceso de Caja en el mismo navegador cuando la vinculación y los permisos lo permiten; un problema de Caja no bloquea Administración. Caja conserva sesión local de doce horas y verificador PBKDF2-SHA256 (600.000 iteraciones, sal aleatoria) para usuarios ya validados. Primer acceso e inscripción de terminal requieren conexión; solo dueño vincula. Un perfil por caja; otras pestañas del mismo origen comparten instalación, secuencia y sesión. Logout invalida sesión local y comunica el cierre a otras pestañas. Cambios remotos conocidos revocan acceso.

## Persistencia

IndexedDB `nativos-caja`, versión 1, almacén `state`. Agregado comercial cifrado AES-GCM con IV aleatorio de 96 bits y clave de 256 bits no exportable en el mismo almacén. No guardar contraseñas en claro ni credenciales en localStorage. El cifrado no representa aislamiento frente a JavaScript del mismo origen, extensiones privilegiadas o control del perfil. Clave y agregado se escriben juntos; pérdida de la clave impide recuperación local.

Cada comando toma Web Lock exclusivo `nativos-caja-writer`, vuelve a leer el agregado, comprueba sesión/concesión, revisión, turno y permisos, calcula con el dominio compartido y escribe la nueva versión en una sola transacción IndexedDB con durabilidad `strict`. Solo el evento complete confirma éxito al usuario. Abort/cuota conserva el estado anterior. Lecturas también pasan por el lock para evitar ver una intención intermedia. Clonar el agregado no representa commit. Segunda pestaña con revisión antigua recibe conflicto; misma operación/intención devuelve respuesta guardada.

Agregado incluye instalación, cursor secuencial, concesiones históricas, máximo temporal, snapshots sin costos, clientes, pedidos, turnos, ventas, devoluciones, eventos, movimientos, comandos idempotentes, outbox, fidelización e intención de canje. La versión incompatible bloquea sin borrar. Esquemas browser precompilados antes del build; CSP mantiene script-src self sin unsafe-eval.

## Sincronización y canje

Conservar `/api/pos/enroll`, `/authorize`, `/sync`, `/redemption/cancel` y payloadVersion 1/2/3. Hash SHA-256 sobre bytes UTF-8 exactos; firma Ed25519 verificada con Web Crypto. El servidor recalcula y valida actor, permiso, caja, secuencia, snapshots e importes. Acuse debe coincidir en todos los campos; una respuesta ajena no elimina pendientes. Conflictos visibles, no descarte automático.

Canje: vaciar outbox, validar saldo/regla central, guardar intención, enviar transacción central y aplicar resultado local atómicamente con retirada de intención. Acuse perdido conserva intención; reinicio la muestra. Cancelación antes del commit impide mensaje tardío; después recupera la venta. Durante incertidumbre se bloquean nuevas escrituras comerciales. Acumulación offline pendiente y devoluciones proporcionales conservan contrato loyalty-v1.

## Shell offline y actualización

Service worker precarga solo HTML/JS/CSS del sitio. Nunca intercepta/cachea API, credenciales, informes o costos. Navegación offline recupera `/` y `/caja`; Administración informa falta de conexión y permite abrir Caja. Cachés por versión, sin skipWaiting forzado; no borrar IndexedDB ni cambiar código de una pestaña durante un cobro. La sincronización ocurre con Caja abierta, cada 15 segundos cuando no se está editando, y manualmente; tras cerrar todas las pestañas se reanuda al abrir. No depender de Background Sync.

Solicitar StorageManager.persist al vincular. El navegador puede denegarlo; no garantiza recuperación frente a limpieza manual del sitio, cambio de origen/perfil o pérdida del disco. HTTPS necesario salvo loopback de desarrollo. Edge/Chrome actuales constituyen el objetivo inicial probado.

## Traslado local anterior

Solo servidor de desarrollo habilita `/api/local-transition` GET y POST `{targetId:UUID}` para dueño autorizado. Rechaza traslado si el servicio antiguo sigue escuchando. Conserva installationId, terminal, cursor, snapshots, pedidos, turnos, ventas/comprobantes, devoluciones, outbox y canje incierto. No traduce verificadores scrypt de Windows: acceso posterior online prepara PBKDF2. Registra auditoría y fija destino único en SQLite, bloqueando escrituras/sync del motor antiguo. Reintento del mismo target conserva la respuesta; otro destino se rechaza. La fuente permanece y no se ofrece borrar ni reemplazar una caja con datos. Navegador persiste su target antes de pedir datos y el agregado completo antes de utilizarlo. Si se pierde el perfil después del traslado, corresponde conciliación explícita; no habilitar otro escritor automáticamente.

No hay puente de lectura de archivos en producción. Impresión silenciosa, cajón y restauración operativa siguen pendientes de ensayo real desde navegador.

Referencias técnicas: [transacciones IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction), [importación de claves Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey).
