# Handoff — Nativos

Fecha: 16 de septiembre de 2026. Actualizado durante el incremento 6 a petición del usuario. Este documento permite retomar sin depender del historial de conversación.

## 1. Objetivo y dirección vigente

Reemplazar Alegra para la operación de Nativos: ventas, inventario, recetas, caja, clientes, fidelización, compras/proveedores, usuarios, auditoría, informes, exportaciones e integraciones. Dos locales iniciales: Milán y Centro, una caja por local. Español, COP y America/Bogota; identidad Nativos y verde #00bf63, temas claro/oscuro y navegación lateral.

**Cambio decisivo del usuario, 15-09-2026:** quiere un solo sitio web que reúna Administración y Caja, no una aplicación de escritorio separada. Confirmó expresamente conservar hasta siete días offline y recuperar pedidos al cerrar/reabrir el navegador. Aplicar DEC-021 y spec 012 por encima de referencias históricas a Electron/SQLite. No volver a diseñar el producto como app Windows.

La implementación local está autorizada desde el 13-09-2026. No hay autorización de producción, contratación, modificaciones en Alegra ni mensajes reales. No se desplegó ni se migraron datos comerciales externos.

## 2. Dónde trabajar y qué leer

- Carpeta del proyecto: `C:/Users/pc/Documents/Codex/nativos-alegra/software-nativos`.
- La carpeta de trabajo superior de Codex puede ser `C:/Users/pc/Documents/Codex/nativos-alegra`; especificar el subdirectorio del proyecto en comandos.
- Windows, PowerShell; Node 24.15, PostgreSQL 18.4 empaquetado para desarrollo. Consultar package.json/lockfile para versiones fijadas.
- Leer primero `agents.md` (minúsculas), `software-nativos.md`, `README.md`, `docs/sdd.md`, `specs/README.md`, `docs/architecture.md` y `docs/decisions.md`.
- Dirección nueva: `docs/web-transition.md`, `specs/012-unified-web/{spec,plan,tasks}.md`, `contracts/browser-pos-v1.md`.
- Seguir SDD: requisito → aceptación → diseño/contratos → tareas → código → pruebas/evidencia. No resolver por suposición decisiones de negocio pendientes.

## 3. Estado actual

### Entregado y comprobado localmente

| Etapa | Alcance |
| --- | --- |
| 0–1 | Fundamentos, configuración inicial, usuarios, permisos, sucursales/bodegas y auditoría |
| 2 | Catálogo, terminados/preparados, recetas/opciones/versiones, existencias iniciales, mínimos y reversiones |
| 3 | Primera venta, turnos, consumo, comprobante, persistencia y sincronización; originalmente SQLite/DPAPI/Electron |
| 4 | Clientes, pedidos múltiples, mesas/domicilios manuales, notas/descuentos, comandas, desperdicio, división, pagos combinados y devoluciones |
| 5 | Fidelización, inscripción, acumulación offline pendiente, canje central, reglas/ajustes auditados y devolución de puntos |
| 5W / 012 | Sitio único, Caja en navegador, IndexedDB/Web Locks/Web Crypto, shell offline, pruebas de navegador y puente de traslado de datos anteriores |
| 6 (parcial por decisiones) | Compras/proveedores, traslados, conteos/ajustes, consumo interno, movimientos de Caja, Informes/XLSX y respaldo/restauración local |

Esto no significa que todas las especificaciones del producto estén completas. Del incremento 6 solo quedan costo promedio/márgenes (DEC-005) y política externa de respaldo, retención, RPO/RTO (DEC-012); hardware, integraciones y lanzamiento siguen pendientes.

### Servicios y datos al cierre

- Sitio: `http://127.0.0.1:4310/`.
- Caja: `http://127.0.0.1:4310/caja`.
- Última comprobación al actualizar: 4310 escucha mediante `scripts/dev.ts` (PID local efímero 32412); 54329 pertenece a PostgreSQL de desarrollo. No se inició 4311.
- Antes se comprobó HTTP 200 y renderizado de h1 sin errores JavaScript en ambas rutas. Configuración inicial conservada: setupRequired=false.
- En la continuación posterior, el perfil real abierto en Caja quedó activo como **Leonardo Velasquez · milan-caja**. La interfaz mostró conexión vigente, concesión offline hasta el 22-09-2026, cero pendientes, ningún pedido abierto, ningún comprobante y ningún turno abierto. Este es el estado visible del perfil; no se alteraron datos ni se abrió un turno durante la verificación.
- PostgreSQL de desarrollo: `.local/development/`; NO borrar ni reiniciar configuración para arreglar acceso.
- Caja anterior: `.local/pos/pos.sqlite` y `.local/pos/vault.dpapi`, conservados. Última lectura de solo conteos antes/después del cambio: 2 pedidos, 1 turno, 0 ventas, 0 devoluciones y 3 filas outbox ya confirmadas; pendientes=0. No inferir que este estado seguirá igual después de que el usuario opere.
- **No se trasladó automáticamente la caja real al perfil de pruebas.** El dueño debe usar el perfil de navegador elegido y pulsar “Trasladar caja anterior”. No activar otra instalación ni forzar reemplazo para sortear el conflicto.

## 4. Arquitectura implementada

### Sitio y servidor

React/TypeScript, Administración en `/` y Caja en `/caja`, mismo origen y cookie web. API modular Fastify/Node/PostgreSQL existente. Se conservan permisos en servidor y validación/recomputación de operaciones comerciales. Electron fue retirado de dependencias y del comando normal. `desktop/` y `src/pos/` permanecen como código histórico/compatibilidad; no son la nueva ruta de producto.

`start:local` compila y arranca servidor web + PostgreSQL como procesos ocultos. Ya no inicia el servicio POS de 4311. El servidor local es desarrollo: el cliente del sitio alojado no requerirá instalar Node/PostgreSQL. No hay alojamiento productivo configurado.

### Caja web

- `web/offline/engine.ts`: estado, sesión, permisos, comandos, ventas/turnos, sincronización y canje.
- `web/offline/storage.ts`: IndexedDB `nativos-caja`, versión 1, almacén `state`; agregado cifrado y clave no exportable. Web Lock `nativos-caja-writer` serializa lectura/cálculo/commit entre pestañas. Transacción readwrite con durabilidad strict; éxito solo tras complete.
- `web/offline/crypto.ts`: AES-GCM se utiliza en storage; SHA-256, PBKDF2-SHA256 con sal y 600.000 iteraciones, verificación Ed25519 con Web Crypto. No contraseñas en claro en almacenamiento ni tokens en localStorage.
- Sesión local de 12 horas y concesión offline hasta siete días son cosas diferentes. Después de expirar sesión se puede volver a entrar offline con verificador previamente preparado. Primer acceso/vinculación exige conexión; si existe solo cookie online, la UI solicita contraseña para preparar acceso offline.
- Dominios exactos compartidos: `src/catalog.ts`, `src/pos-domain.ts`, `src/orders-domain.ts`, `src/loyalty.ts`; políticas `authorization.ts` y `sync.ts`.
- `scripts/browser-contracts.ts` genera validadores estáticos en `web/offline/generated/`; Vite usa adaptador de contratos browser para evitar AJV/eval en runtime. No importar compiladores AJV en componentes navegador.
- `scripts/build-offline.ts`: genera service worker por versión; precarga HTML/JS/CSS, theme.js, icono y manifiesto. Nunca cachea API, sesiones, costos ni informes. No usa skipWaiting forzado ni borra IndexedDB.
- Sincroniza al abrir Caja, periódicamente cuando no se edita y manualmente. Cerrar todas las pestañas suspende actividad hasta reabrir; no prometer sincronización con el navegador cerrado.

### Canjes y datos anteriores

Canje conserva DEC-020: vaciar outbox, consultar saldo/regla, guardar intención durable, confirmar centralmente venta+puntos+movimientos, aplicar localmente y retirar intención con acuse exacto. Respuesta perdida/reinicio conserva intención. Cancelar antes del commit impide mensajes tardíos; después del commit recupera la venta. No liberar puntos por una respuesta incierta ni crear otro cobro.

`src/server/local-transition.ts`, habilitado solo por `scripts/dev.ts`, ofrece puente autenticado de desarrollo para el dueño. Comprueba servicio anterior detenido, conserva identidad/secuencia/historia/outbox/intención, registra auditoría y fija destino único. Reintento del mismo destino es permitido; otro se rechaza. `src/pos/engine.ts` bloquea el escritor antiguo cuando existe `browserTransferTarget`. No copiar la instalación a varios perfiles. Las credenciales scrypt anteriores no se reutilizan como verificadores browser: se prepara PBKDF2 online.

Las migraciones SQL 001–005 NO se modificaron en esta transición; se verificaron hashes contra evidencia del incremento 5. No editar migraciones ya aplicadas.

## 5. Reglas de negocio que deben mantenerse

- Terminado consume unidades; preparado consume receta/versiones/opciones efectivamente usadas, al cobrar.
- Comanda no consume; cancelación registra desperdicio solo de unidades preparadas. Inventario negativo permitido con alerta.
- Descuentos y cancelación antes del cobro no requieren aprobación de otro usuario. Altas de productos/recetas/clientes online para roles autorizados.
- Impuesto opcional: null distinto de 0% y exención; no inventar tasas ni conversiones.
- Costos/márgenes solo dueño, también en servidor/cache/exportación. Encargado registra y consulta importes de compras de su local, sin acceso a costos de receta/márgenes.
- Propina porcentual sobre productos netos tras descuento, antes del canje y sin domicilio. Efectivo admite cambio; excedentes digitales no se convierten en efectivo.
- Devoluciones posteriores al cobro requieren permiso. El usuario confirmó devolver también propina y domicilio hasta sus saldos.
- Fidelización inicial: 1 punto entero por COP 1.000 pagados en productos tras descuento/canje; COP 10 por punto, máximo 20%, sin vencimiento. Propina/domicilio no generan puntos.
- Devoluciones restituyen dinero realmente pagado y puntos utilizados proporcionalmente; revierten ganados. Saldo negativo permitido, compras permitidas y canjes insuficientes bloqueados. Sin puntos retroactivos por migraciones o historia anterior.
- Tras siete días sin validar: bloquear nuevos cobros/aperturas; conservar consulta, pedidos y cierre del turno. Nunca borrar pendientes.

## 6. Verificación realizada y límites de la evidencia

| Comando/escenario | Último resultado registrado |
| --- | --- |
| `npm run check` | TypeScript y 33 pruebas de dominio/políticas correctos. La siguiente ejecución de integración aislada concluyó tras recorrer las suites; conservar pruebas focalizadas abajo como evidencia directa de incremento 6. |
| `node --test tests/integration/loyalty.test.ts` | Resultado histórico focalizado: 9/9, incluyendo traslado con outbox pendiente exacto, reintento y rechazo de segundo destino |
| `npm run test:e2e` | Ejecutado nuevamente después de la cobertura de traslado UI: flujo integrado correcto en Edge con servidor/base sintética aislada |
| Pruebas browser | Aborto IndexedDB antes de commit, dos pestañas cobrando misma revisión, cierre real de Edge y reapertura offline del mismo perfil, contraseña offline incorrecta/correcta, fecha ocho días después, canje con respuesta perdida y recuperación |
| Seguridad/UI | API fuera de Cache Storage; sin costos en caché POS; axe, teclado, escritorio/móvil y claro/oscuro en flujos evaluados |
| Traslado UI interrumpido/reintento | E2E crea una Caja histórica sintética, abre turno con COP 25.000, aborta la respuesta después del commit central, reintenta en el mismo perfil y reabre offline con contraseña de dueño; turno y base se conservan |
| Incremento 6 focalizado | `npm run typecheck`, `npm run build`, `npm run test:e2e`, `git diff --check`, `tests/integration/{cash,reports,backup}.test.ts` correctos en las ejecuciones registradas |

La cobertura UI del traslado ya está incorporada a la regresión. Sigue faltando el traslado real desde el perfil elegido por el usuario: la E2E no acredita que los datos comerciales reales hayan sido trasladados ni sustituyó el navegador del usuario.

Evidencia: `docs/evidence/increment-{2,3,4,5}.md` y `docs/evidence/unified-web.md`, con capturas y manifiestos SHA-256 en sus directorios. No sobrescribir evidencia histórica al ejecutar pruebas nuevas. E2E actual escribe en `docs/evidence/unified-web/`.

No se verificaron producción, hardware, impresión silenciosa, cajón, instalación del acceso directo PWA ni resistencia a pérdida total del perfil/disco. El respaldo/restauración local solo cubre hechos ya sincronizados y no sustituye respaldo externo; el agregado IndexedDB no se dimensionó con volumen comercial real.

## 7. Fallos, causas y correcciones

| Fallo observado | Causa / solución aplicada |
| --- | --- |
| Se agotaron tokens y hubo que retomar incremento 5 | Reanudado desde archivos/evidencia; este handoff evita depender de memoria de conversación |
| El sitio no cargaba en etapas previas | Hubo procesos locales detenidos y un problema de compilación AJV en navegador bajo CSP; se separaron validadores del runtime UI y se consolidó lanzador persistente. En cierre actual solo 4310 es sitio web |
| Endpoints de fidelización devolvían 404 | Faltaba registrar `registerLoyalty`; corregido en app.ts |
| Recuperación de canje tras reinicio sin cookie online | El motor no refrescaba caché usando concesión anterior; se añadió renovación/verificación correspondiente |
| Comparación de acuse por JSON reserializado | PostgreSQL JSONB podía ordenar claves de otra manera; ahora se comparan explícitamente todos los campos inmutables |
| Devolución pagada totalmente con puntos rechazada por dinero cero | Validación ajustada para permitir restitución de puntos sin devolución de efectivo; caso de dominio agregado |
| Error normal de pago cerraba el formulario | Solo se cierra ante intención de canje pendiente; importe insuficiente mantiene el formulario abierto |
| Motivo de cambio de reglas con solo espacios | Rechazo explícito en servidor y prueba focalizada |
| TypeScript con import standalone de AJV | Ajustada firma del import CommonJS para el generador; validadores estáticos browser generados durante build |
| TypeScript exigía atributo JSON y tipado de sal | Añadido `with {type:'json'}` y tipo string de sal PBKDF2; sin relajar chequeos de acceso |
| Opción unicode obsoleta / helper require en validadores | Se conserva conteo Unicode con implementación estática compatible con bundle/CSP; eliminada opción obsoleta |
| E2E de login offline esperaba “Nueva venta” | La vista Comprobantes seguía seleccionada después de reingresar; se corrigió la expectativa del test, no la autenticación |
| Aviso vacío en canje incierto | La restricción textual estaba vacía cuando el bloqueo era la intención; UI muestra ese aviso solo si hay texto |
| theme.js fuera del precache inicial | Incorporado junto con manifiesto/icono para reapertura offline consistente |
| Lectura de archivos desde carpeta superior | El proyecto está en software-nativos; usar workdir explícito |

Los cortes de red, aborto IndexedDB y carreras entre pestañas de las pruebas son fallos inyectados, no pérdidas de datos reales. Se comprobaron preservación/reintento; no se realizaron cobros bancarios.

## 8. Siguientes pasos, en orden

1. Leer este handoff y las fuentes vigentes. Comprobar `git status` y servicios antes de tocar archivos; no reiniciar desde cero.
2. El perfil visible de Caja ya está activo y sin pendientes. Si se necesita una conciliación documental del traslado, comparar de forma explícita contra la fuente conservada pedidos, turno, historia, secuencia y pendientes; no crear otro destino de navegador ni reactivar el escritor anterior.
3. El piloto E2E ya comprobó actualización de service worker con un comprobante pendiente: el worker nuevo espera y la reapertura offline conserva IndexedDB. La solicitud de almacenamiento persistente se ejecuta tanto en enrolamiento como en traslado. No se verificó una concesión real del navegador del usuario y no se promete protección frente a limpieza del sitio; medir crecimiento/rendimiento con volumen definido antes de lanzamiento.
4. Resolver DEC-005: definir costo promedio ante saldo negativo y entradas tardías, su conciliación y la historia que se conserva. No inventar costos ni márgenes mientras falte esa decisión.
5. Resolver DEC-012: definir ubicación externa, retención, presupuesto, RPO y RTO. El respaldo local ya crea/verifica/restaura en base aislada, pero no protege pérdida total de disco ni pendientes IndexedDB.
6. Una vez decididas, completar costeo/márgenes y la política operativa de respaldo; después continuar incremento 7 (WhatsApp y API/MCP) e incremento 8 (historial Alegra, conciliación, inventario físico, hardware/fiscalidad y lanzamiento conjunto). No adelantar contratación, envíos o publicación.

Hardware conocido: Milán T80A USB 80 mm; Centro NP/New Print T82E USB 80 mm. Se debe probar desde navegador impresión de comprobantes/comandas y cajón; no inferir soporte idéntico en ambas.

## 9. Comandos y cuidados operativos

```powershell
# Ejecutar desde software-nativos
npm.cmd run start:local
npm.cmd run typecheck
npm.cmd run check
npm.cmd run test:e2e
```

`start:local` no duplica servicio si el puerto ya escucha, pero tampoco sustituye un proceso que conserva código de servidor viejo: si se cambia backend, comprobar PID/comando y reiniciar solo ese servicio. Lanzar procesos ocultos. No matar procesos PostgreSQL ajenos ni borrar .local como solución.

E2E usa servidor/base sintética en 4320 y perfiles `.local/browser-e2e-*`; no ejecutar dos E2E al mismo tiempo. Tests de integración usan sus propias carpetas `.local/test-*`. No incluir secretos, volcados de vault, datos personales ni contraseñas efímeras en logs/evidencia.

## 10. Git y archivos cambiados

HEAD al escribir: `d33a6867dca602b6aab79a5b7165337e54e3d1c0`. **No se hizo commit en estas continuaciones.** Hay cambios rastreados y muchos archivos sin seguimiento de incrementos 2–5 además de 5W. No asumir que todo el diff corresponde a la transición ni descartar archivos untracked. package-lock.json no aparece modificado frente a HEAD tras retirar Electron; conservar su estado real, no inventar un diff.

### Archivos principales de la transición web

- Documentación: `README.md`, `agents.md`, `software-nativos.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/roadmap.md`, `docs/web-transition.md`, `specs/README.md`, specs afectadas y notas históricas en planes/contratos.
- Requisitos nuevos: `specs/012-unified-web/spec.md`, `plan.md`, `tasks.md`; contrato `contracts/browser-pos-v1.md`.
- Navegador: `web/offline/engine.ts`, `storage.ts`, `crypto.ts`, `contracts.ts`, `register.ts`, `generated/validators.js` y `.d.ts`.
- Interfaz: `web/main.tsx`, `web/Pos.tsx`, `web/api.ts`, `web/OrderForms.tsx`, `index.html`, `pos.html`; manifiesto e icono en `public/`.
- Build/arranque: `scripts/browser-contracts.ts`, `scripts/build-offline.ts`, `scripts/start-local.ps1`, `scripts/dev.ts`, `vite.config.ts`, `package.json`.
- Servidor/traslado: `src/server/app.ts`, `src/server/local-transition.ts`, protección de retiro en `src/pos/engine.ts`.
- Pruebas: `scripts/e2e-server.ts`, `tests/e2e/{foundation.spec,browser-flow,pos-flow,catalog-flow,loyalty-flow}.ts`, `tests/integration/loyalty.test.ts`.
- Evidencia: `docs/evidence/unified-web.md` y `docs/evidence/unified-web/`.

### Continuación posterior al handoff

- Se habilitó `registerLocalTransition` también en el servidor E2E aislado (`scripts/e2e-server.ts`), nunca en un servidor alojado.
- `tests/e2e/browser-flow.ts` crea una caja anterior sintética, prueba pérdida de respuesta tras commit, reintento con destino idéntico y reingreso offline del dueño. No reutiliza `.local/pos` ni el perfil real.
- `docs/evidence/unified-web.md` registra esa ejecución. `handoff.md` también fue actualizado en esta continuación.

### Incremento 6 — continuación de caja

- Migración aditiva `010-cash-movements.sql`, contrato `contracts/cash-movements-v1.md` y acción `cash.movement`: ingresos, gastos, retiros y correcciones causales pertenecen al turno y conservan idempotencia en la cadena de Caja.
- El efectivo esperado suma solo los deltas de efectivo; tarjeta, transferencia, Bre-B, Daviplata y Nequi quedan separados. El cierre server-side usa el mismo libro. No se edita ni elimina el movimiento original.
- `tests/integration/cash.test.ts` valida ingreso COP 386.000, retiro COP 50.000, corrección, digital, reintento y cierre COP 536.000. `npm run test:e2e` pasó tras registrar un gasto sintético en Caja. El sitio local se recompiló y escucha en 4310.
- Informes/Excel y respaldo/restauración local ya están entregados. Continúan pendientes costo promedio/márgenes (DEC-005) y la política externa de respaldo (DEC-012); no declarar terminado el incremento 6 todavía.

### Incremento 6 — informes y exportación

- `src/server/reports-api.ts` publica consultas autorizadas de ventas, caja, inventario, compras, desperdicio y fidelización por sucursal y período. La respuesta conserva paginación, totales y la antigüedad de la última sincronización por sucursal.
- `web/Reports.tsx` agrega Informes a Administración y descarga un XLSX real con hojas Contexto, Datos y Totales. No expone costos o márgenes: DEC-005 continúa pendiente.
- `tests/integration/reports.test.ts` verifica 120 filas paginadas en 20 y que el XLSX contiene las 120. `npm.cmd run test:e2e` también pasó al abrir Informes y descargar el archivo. El alcance no bloqueado de Informes está cubierto; no declarar completo el incremento 6 hasta resolver DEC-005 y DEC-012.
- La continuación agregó filtros efectivos de ventas por producto, cliente y medio; de compras por proveedor/medio; y de desperdicio/fidelización por identidad. Las devoluciones ahora se publican como filas separadas y concilian los totales de productos, descuentos, canje, propina, domicilio y pagos. La pantalla presenta esos filtros con las opciones autorizadas. La integración focalizada y E2E pasaron.
- La integración también autentica un cajero con alcance Centro y verifica tanto consulta como XLSX de ventas filtrado, sin columnas o valores de costo/margen.
- `reports-api.ts` ejecuta tanto consulta como exportación dentro de `REPEATABLE READ READ ONLY`; el XLSX, sus filas y los totales pertenecen a la misma instantánea de PostgreSQL.

### Incremento 6 — respaldo y restauración local

- `src/server/backup-api.ts` entrega `POST/GET /api/backups`, `POST /verify` y `POST /restore-check` solo a dueño con `settings.manage`. Guarda el respaldo lógico local y el manifiesto en `.local/backups` del servidor de desarrollo, con checksum SHA-256, tamaño, versión de esquema y cobertura `server-synchronized-only`; la lista no devuelve los datos respaldados. Crear, verificar y conciliar dejan auditoría.
- `web/Backups.tsx` permite al dueño operar ese ciclo desde Administración. La restauración exige `RESTORE {id}`, crea solo una base configurada que todavía no existe, migra/restaura/concilia y rechaza destino activo o existente; no borra ni sustituye bases. `tests/integration/backup.test.ts` pasó incluidos confirmación, conciliación, destino repetido y artefacto alterado. DEC-012 y DEC-005 siguen pendientes; no se ha tocado una base comercial.

### Estado actualizado — 16-09-2026

- El servidor local de desarrollo quedó recompilado y escucha en 4310 mediante `scripts/dev.ts`; no tocar PostgreSQL de `.local/development/` ni iniciar la ruta histórica 4311.
- Los archivos centrales del incremento 6 incluyen migraciones `006`–`010`, `src/server/{pos-api,reports-api,backup-api,xlsx}.ts`, `web/{Purchases,InventoryOperations,Reports,Backups,Pos}.tsx`, contratos de inventario/caja/informes/respaldo y sus pruebas de integración/E2E.
- El árbol Git continúa intencionalmente sin commit y con cambios heredados de incrementos anteriores. `git status --short` al actualizar confirma archivos nuevos de incremento 6 y modificaciones históricas; no descartar ni restaurar cambios ajenos.
- Los únicos entregables de incremento 6 no implementables sin nueva definición son valoración promedio, costos/márgenes (DEC-005), y respaldo externo/retención/RPO/RTO (DEC-012).

### Cambios anteriores conservados

Catálogo (`src/catalog.ts`, catalog-api, web/Catalog), clientes (customers-api, web/Customers), dominio de pedidos/ventas y adaptadores `src/pos`, fidelización (loyalty, loyalty-api, web/Loyalty), contratos, migraciones 002–005, pruebas y planes/tareas de sus incrementos. Consultar sus manifiestos/evidencias para atribución precisa.

### Inventario exacto de trabajo pendiente en Git

Capturado antes de crear este handoff. `M` significa archivo rastreado modificado; `??` archivo/directorio sin seguimiento. Este inventario incluye trabajo heredado; no prueba que cada archivo se modificara en la última transición. Añadir `handoff.md` como nuevo archivo de esta petición.

```text
 M README.md
 M agents.md
 M contracts/sync-v1.schema.json
 M docs/architecture.md
 M docs/decisions.md
 M docs/roadmap.md
 M index.html
 M package.json
 M playwright.config.ts
 M scripts/dev.ts
 M scripts/e2e-server.ts
 M scripts/local-postgres.ts
 M software-nativos.md
 M specs/001-foundation/plan.md
 M specs/001-foundation/spec.md
 M specs/002-catalog-recipes/spec.md
 M specs/003-inventory-purchases/spec.md
 M specs/004-sales/spec.md
 M specs/005-customers-loyalty/spec.md
 M specs/006-cash/spec.md
 M specs/007-offline-sync/contracts/sync-v1.md
 M specs/007-offline-sync/plan.md
 M specs/007-offline-sync/spec.md
 M specs/011-migration-release/spec.md
 M specs/README.md
 M src/authorization.ts
 M src/contracts.ts
 M src/server/api-contract.ts
 M src/server/app.ts
 M tests/authorization.test.ts
 M tests/e2e/foundation.spec.ts
 M tests/integration/foundation.test.ts
 M web/api.ts
 M web/components.tsx
 M web/main.tsx
 M web/styles.css
?? contracts/browser-pos-v1.md
?? contracts/catalog-inventory-v1.json
?? contracts/catalog-inventory-v1.md
?? contracts/customers-v1.schema.json
?? contracts/loyalty-v1.md
?? contracts/loyalty-v1.schema.json
?? contracts/orders-v2.md
?? contracts/orders-v2.schema.json
?? contracts/orders-v3.schema.json
?? contracts/pos-api-v1.json
?? contracts/pos-local-v1.schema.json
?? contracts/pos-payload-v1.schema.json
?? contracts/pos-snapshot-v1.schema.json
?? contracts/pos-v1.md
?? desktop/
?? docs/evidence/increment-2.md
?? docs/evidence/increment-2/
?? docs/evidence/increment-3.md
?? docs/evidence/increment-3/
?? docs/evidence/increment-4.md
?? docs/evidence/increment-4/
?? docs/evidence/increment-5.md
?? docs/evidence/increment-5/
?? docs/evidence/unified-web.md
?? docs/evidence/unified-web/
?? docs/web-transition.md
?? migrations/002-catalog-inventory.sql
?? migrations/003-pos-sales.sql
?? migrations/004-orders-customers.sql
?? migrations/005-loyalty.sql
?? pos.html
?? public/manifest.webmanifest
?? public/nativos-icon.svg
?? scripts/browser-contracts.ts
?? scripts/build-offline.ts
?? scripts/pos.ts
?? scripts/start-local.ps1
?? specs/002-catalog-recipes/plan.md
?? specs/002-catalog-recipes/tasks.md
?? specs/003-inventory-purchases/plan.md
?? specs/003-inventory-purchases/tasks.md
?? specs/004-sales/plan-increment-4.md
?? specs/004-sales/plan-increment-5.md
?? specs/004-sales/plan.md
?? specs/004-sales/tasks-increment-4.md
?? specs/004-sales/tasks-increment-5.md
?? specs/004-sales/tasks.md
?? specs/005-customers-loyalty/plan-increment-4.md
?? specs/005-customers-loyalty/plan-increment-5.md
?? specs/005-customers-loyalty/tasks-increment-4.md
?? specs/005-customers-loyalty/tasks-increment-5.md
?? specs/006-cash/plan-increment-4.md
?? specs/006-cash/plan.md
?? specs/006-cash/tasks-increment-4.md
?? specs/006-cash/tasks.md
?? specs/007-offline-sync/plan-increment-3.md
?? specs/007-offline-sync/plan-increment-4.md
?? specs/007-offline-sync/plan-increment-5.md
?? specs/007-offline-sync/tasks-increment-3.md
?? specs/007-offline-sync/tasks-increment-4.md
?? specs/007-offline-sync/tasks-increment-5.md
?? specs/012-unified-web/
?? src/catalog.ts
?? src/loyalty.ts
?? src/orders-contract.ts
?? src/orders-domain.ts
?? src/pos-contract.ts
?? src/pos-crypto.ts
?? src/pos-domain.ts
?? src/pos/
?? src/server/catalog-api.ts
?? src/server/customers-api.ts
?? src/server/local-transition.ts
?? src/server/loyalty-api.ts
?? src/server/orders-sync.ts
?? src/server/pos-api.ts
?? tests/catalog.test.ts
?? tests/e2e/browser-flow.ts
?? tests/e2e/catalog-flow.ts
?? tests/e2e/loyalty-flow.ts
?? tests/e2e/pos-flow.ts
?? tests/integration/catalog.test.ts
?? tests/integration/loyalty.test.ts
?? tests/integration/orders.test.ts
?? tests/integration/pos.test.ts
?? tests/loyalty.test.ts
?? tests/orders.test.ts
?? tests/pos.test.ts
?? vite.config.ts
?? web/Catalog.tsx
?? web/Customers.tsx
?? web/Loyalty.tsx
?? web/OrderForms.tsx
?? web/Pos.tsx
?? web/offline/
?? web/pos.css
```
