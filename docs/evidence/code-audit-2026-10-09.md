# Revisión integral del código — 09-10-2026

Estado: revisión y correcciones completadas, verificadas localmente. Autorización: solicitud del usuario para revisar vulnerabilidades, código obsoleto y refactorizar cuando fuera necesario. Trazabilidad: [019](../../specs/019-code-audit/spec.md), [plan](../../specs/019-code-audit/plan.md) y [tareas](../../specs/019-code-audit/tasks.md).

## Alcance y método

Árbol vigente de `software-nativos`, anclado a `67d90f6` en `main`. Se revisaron servidor/API, permisos, consultas PostgreSQL, contratos/migraciones, reglas de ventas e inventario, fidelización, Caja en navegador, sincronización, Excel, respaldos, dependencias, scripts, pruebas y documentación. Los otros dos directorios son worktrees históricos y no se modificaron. Los Excel originales y las bases/perfiles comerciales se preservaron.

La habilidad code-review se aplicó con los ejes Standards y Spec en revisiones independientes. La solicitud de revisar el proyecto completo sustituyó el alcance habitual de un diff. Hallazgos reproducibles se corrigieron con pruebas; las heurísticas de mantenimiento y pendientes operativos se presentan separados. La verificación usa PostgreSQL, SQLite y perfiles de navegador sintéticos, nunca ventas reales ni escrituras en Alegra. No se hizo una prueba de penetración en el servicio publicado ni se cambió su configuración.

## Standards

| ID | Prioridad | Hallazgo y escenario | Corrección y evidencia |
| --- | --- | --- | --- |
| S01 | P1 | Una base alojada vacía exponía `/api/setup`: cualquier visitante podía registrar al primer dueño. Host, origen y cabecera CSRF no identificaban al instalador. | Clave externa `NATIVOS_SETUP_TOKEN`, comparación de hashes en tiempo constante, cierre por defecto fuera de loopback HTTP y campo de instalación. AC-019-02, API con origen HTTPS contra PostgreSQL real y formulario E2E. [Servidor](../../src/server/app.ts), [configuración](../../src/server/production-config.ts), [contrato](../../contracts/foundation-api-v1.json). |
| S02 | P2 | `audit()` fijaba `actor_kind=human` también para operaciones de agentes. | Parametrizar `actor.user.kind`; importación real de agente confirma `agent` y operación humana confirma `human`. No reescribir historia inmutable. AC-019-04. [Auditoría](../../src/server/db.ts). |
| S03 | P2 | Notificaciones generaba UUID como cursor y luego lo convertía a cero, repitiendo la primera página. | Conservar/validar ID completo; recorrer tres páginas distintas. AC-019-05. [Notificaciones](../../src/server/notifications-api.ts). |
| S04 | P2 | Inventario de agentes rechazaba su propio cursor `warehouseId:itemId`. | Validar dos IDs solo en inventario y ordenar/comparar por el mismo cursor compuesto. Segunda página distinta y rechazo del cursor compuesto en productos. AC-019-05. [API de agentes](../../src/server/agent-api.ts). |
| S05 | P2 | Informes admitía límites no enteros y fechas inexistentes; valores como `limit=1.5` podían producir 500. | Validación previa de enteros 1–100, fechas y cursores; casos malformados devuelven 400. AC-019-05. [Informes](../../src/server/reports-api.ts). |
| S06 | P2 | Importes válidos con más de nueve dígitos se convertían silenciosamente a cero en totales. | Usar el rango exacto de `numeric(30,6)` y dominio: 24 dígitos enteros/seis decimales. Prueba de `1000000000.123456`, efectivo y digitales exactos. AC-019-05. |
| S07 | P2 | Nombres/notas con controles prohibidos por XML generaban Excel que no abría. | Retirar caracteres XML 1.0 inválidos, preservar Unicode/TAB/LF/CR y escapar nombre después de limitar longitud. Abrir archivo con ExcelJS; una cadena de fórmula sigue siendo texto. AC-019-05. [Serializador](../../src/server/xlsx.ts). |
| S08 | P2 | Productos/recetas archivados seguían apareciendo como vendibles en la API de agentes. | Excluir productos/recetas/insumos archivados de consultas operativas; conservar el historial. AC-019-05. |
| S09 | P2 | Un inicial `import_initial` bloqueaba una nueva carga, pero su ruta de reversión solo admitía `initial`. | Aceptar ambos tipos con la misma reversión causal, idempotencia y permisos. Confirmar importación, revertir una vez y registrar un inicial nuevo. AC-019-05. [Inventario](../../src/server/catalog-api.ts). |
| S10 | P2 | Ordenar por `localeCompare` y paginar con comparación directa de ID podía omitir filas con diferencias de mayúsculas/minúsculas. | Orden y comparación usan la misma relación. Dos ventas con IDs que difieren por mayúsculas recorren ambas páginas. AC-019-05. |
| S11 | P1 | La revalidación de Caja podía recibir el grant de B=dueño por la cookie web y guardarlo bajo A=cajero con la contraseña de A. Después, A entraba offline con permisos de B. También afectaba cambios de sucursal y el alta inicial. | Verificar el actor previo firmado al reutilizar un verificador; login/setup devuelven la identidad autenticada que debe coincidir con el grant. Guardar la sesión después de validar, conservar el actor de altas sin terminal y exigir credenciales nuevas para estados antiguos sin identidad demostrable. Motor real con firmas Ed25519 prueba cookie ajena, acceso offline, carrera entre pestañas, activación, cambio de caja, usuario recreado y renovación legítima de permisos. AC-019-09. [Motor](../../web/offline/engine.ts), [login/setup](../../src/server/app.ts), [regresión](../../tests/browser-engine-audit.test.ts). |

No se identificó una nueva SQLi ni una fuga directa de costos en las rutas examinadas: los valores usan parámetros, las sucursales se autorizan y costos/compra conservan sus permisos distintos. Las importaciones Excel siguen limitando tamaño comprimido/expandido y rechazando fórmulas. Estas observaciones describen el alcance revisado y probado.

## Spec

| ID | Prioridad | Requisito afectado y escenario | Corrección y evidencia |
| --- | --- | --- | --- |
| F01 | P1 | REQ-006-03: después de corregir un retiro, Caja aceptaba una segunda contrapartida, alteraba efectivo y quedaba bloqueada al recibir `movement_already_corrected`. | Dominio `cashMovementDelta`/`canCorrectCashMovement`, guardia antes de persistir e interfaz sin segunda acción. Motor real conserva saldo, secuencia, comandos y outbox ante duplicado; reintento exacto idempotente, incluido libro descargado. AC-019-03 y E2E. [Dominio](../../src/pos-domain.ts), [motor](../../web/offline/engine.ts), [interfaz](../../web/Pos.tsx). |
| F02 | P1 | REQ-007-04: un reloj cuatro segundos atrasado admitía la concesión, pero el servidor rechazaba el catálogo recién descargado por una comparación temporal estricta. | Reusar la tolerancia existente de cinco segundos para catálogo, apertura y fidelización; no cambiar precios, recetas ni fechas históricas. Aceptar cuatro segundos y rechazar fuera del límite sin consumir secuencia. AC-019-07. [Pedidos](../../src/server/orders-sync.ts), [POS](../../src/server/pos-api.ts). |
| F03 | P2 | REQ-008-01/03: Compras registraba `efectivo/tarjeta/transferencia/otro`, pero los filtros usaban `cash/card/transfer`; resultados y Excel perdían compras válidas. | Equivalencias explícitas, opción Otro y limpieza del medio al cambiar tipo de informe. Conservar el código histórico almacenado. AC-019-05. |
| F04 | P2 | REQ-008-01 y plan §11: el JOIN de fidelización excluía ajustes sin venta y filtraba devoluciones por fecha de la compra original. | Consultar libro por sucursal/fecha del movimiento; conservar referencia de venta cuando existe. Probar ajuste, devolución en otro período, exclusión de otra sucursal y exportación. AC-019-05. |
| F05 | P2 | REQ-001-05: la fecha inicial de compra usaba UTC y proponía mañana desde las 19:00 de Bogotá. | Reusar `dashboardDates` con `America/Bogota`, ya cubierto con casos alrededor de medianoche. [Compras](../../web/Purchases.tsx). |
| F06 | P2 | AC-018-06: A cerraba desde el segundo navegador después de que B entrara en el original; B mantenía el turno local de A abierto y no podía abrir el suyo. | `closedShiftIds` limitado a instalación original/continuada, sin actor/importes/libro ajenos. Incorporar marcas solo sin pendientes/canje; liberar turno activo sin inventar cierre ni borrar historia. Motor real prueba A/B y API real verifica alcance/privacidad. AC-019-08. [Proyección](../../src/server/shift-continuation.ts). |
| F07 | P2 | REQ-007-04/REQ-008-01: comprobantes v1 con subtotal/pago único quedaban fuera de importes y filtros modernos. | Normalizar campos financieros con `legacySale`, conservando el registro/las líneas originales. Prueba de una venta histórica con tarjeta, su subtotal y totales digitales. AC-019-05. |

Standards: 11 hallazgos; los de mayor prioridad son el bootstrap alojado abierto y la mezcla de identidades offline (P1). Spec: 7 hallazgos; los de mayor prioridad son doble contrapartida y desfase de catálogo (P1). Cada eje conserva su clasificación; no se utiliza uno para invalidar al otro.

## Dependencias y fuentes de seguridad

`npm audit` inicial: cinco paquetes afectados, dos de severidad alta y tres moderada. Se actualizaron dentro de versiones compatibles, se fijó el lockfile y se verificó una instalación limpia mediante `npm ci --ignore-scripts`.

| Paquete | Antes | Después | Fuente primaria / alcance |
| --- | --- | --- | --- |
| `fastify` | 5.12.4 | 5.12.5 | [GHSA-4mh8-r7rc-xpvc](https://github.com/advisories/GHSA-4mh8-r7rc-xpvc): excepción en respuestas HTTP/2 con trailers. El servidor actual usa HTTP/1 por defecto; se corrigió la dependencia. |
| `brace-expansion` | 5.0.9 | 5.0.12 | [Recursión](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [expansión cuadrática](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr). Override limitado a `minimatch@10.2.6`, conservando ramas antiguas compatibles 1.1.21/2.1.7. No se identificó un glob arbitrario de usuario en las rutas. |
| `fast-uri` | 3.1.7 y 4.1.4 | 3.1.8 y 4.2.1 | [Normalización de host](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj), [mailto](https://github.com/advisories/GHSA-jvvf-x445-j334). La comprobación de origen del proyecto utiliza `URL`, no esta librería. |
| `ip-address` | 10.7.0 | 10.7.3 | [Comparación de familias](https://github.com/advisories/GHSA-j6r3-76f7-8jcv), [diagnóstico sin límite](https://github.com/advisories/GHSA-h3mg-xc3c-68pw). Transitiva de rate-limit; sin allowlist de subredes definida por usuario en la aplicación. |
| `source-map-js` | 1.2.1 | 1.2.2 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q): bloqueo del event loop mediante offsets. Dependencia del build; no se reciben sourcemaps de usuarios. |

La exposición de estas funciones se distingue de la presencia del paquete vulnerable. No se afirmó una explotación en producción. El estado final conocido de `npm audit` es cero vulnerabilidades.

## Código obsoleto y refactorización

- Se retiraron importaciones, tipos, argumentos y variables sin uso de dominio, adaptadores, servidor, UI y pruebas; `noUnusedLocals` y `noUnusedParameters` ahora forman parte del chequeo normal.
- Se extrajo la regla de movimientos de caja para que motor/interfaz usen la misma decisión; se hizo legible el comando que confirma estos movimientos.
- Se extrajo la generación del service worker y se añadió limpieza de caches de interfaz anteriores. No se borra IndexedDB ni se fuerza actualización de clientes aún abiertos.
- `.railwayignore` excluye fuentes Excel/CSV locales, bases y claves, además de los archivos ya excluidos. Los originales comerciales no se empaquetan por esta vía.
- Se corrigió una instrucción que afirmaba que no existía producción pese a publicaciones verificadas registradas.
- `src/pos/`, `desktop/`, contratos y migraciones antiguos se mantienen por migración/lectura y pruebas de compatibilidad (DEC-021). No constituyen una nueva aplicación Electron.

ExcelJS 4.4.0 aún arrastra transitivas declaradas obsoletas: `inflight`, `lodash.isequal`, `rimraf` 2, `glob` 7 y `fstream`. El audit actual no les asigna una vulnerabilidad conocida sin resolver. Forzar versiones mayores rompería sus consumidores; sustituir la biblioteca requiere cubrir plantillas, carga, errores por celda, fórmulas rechazadas, límites ZIP y recetas. Se registra como mantenimiento posterior y no se elimina un importador necesario sin sustituto verificado.

Se hizo explícito el flujo de autenticación, activación y traslado local para poder comprobar la identidad antes de persistir credenciales. El adaptador histórico también rechaza sustituir el actor al conservar un verificador.

Catálogo, informes y el agregado offline siguen concentrando responsabilidades. Una partición futura debe conservar locks, contratos, atomicidad e historia y apoyarse en estos escenarios. No se realizó una reorganización amplia sin beneficio demostrado.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| Referencia antes de cambios | Tipos y 61 pruebas de dominio aprobadas. Integración: 61/62; un `initdb` excedió 60 s sincronizando archivos en Windows. Falló antes de arrancar la aplicación; no fue una aserción de negocio. |
| Instalación limpia | `npm ci --ignore-scripts` aprobado. |
| Dependencias | `npm audit --json`: 0 vulnerabilidades conocidas, incluidas dependencias de desarrollo. |
| Secretos en historial | Gitleaks con redacción: 40 commits / 3,13 MB, cero hallazgos. |
| Dominio final | `npm test`: 68/68, cero fallos/omisiones. Incluye motor real con firmas Ed25519, contrapartidas, reloj, service worker, configuración y Excel. |
| Regresión completa | `npm run check` aprobado: tipos, dominio, 72/72 pruebas de integración y build. |
| Verificación posterior de identidad y contrato | Tras corregir S11: `npm run typecheck`, las 68 pruebas de dominio, 18/18 comprobaciones de integración (auditoría/fundamentos) y `npm run build` aprobados. La integración confirma actor autenticado en login/setup y fechas malformadas controladas. |
| Edge E2E | `npm run test:e2e`: 1/1 recorrido completo aprobado (3,8 min), incluyendo administración, roles, inventario, compras, varios navegadores, cobros/corrección única, cierre/reimpresión offline, fidelización, traslado real desde SQLite, pérdidas de respuesta, accesibilidad y temas/escritorio/móvil. |
| Secretos en árbol entregable | Gitleaks sobre copia de 371 archivos de texto versionados/nuevos: 36 coincidencias, todas falsos positivos verificados como SHA-256 en manifiestos históricos de fuentes; cero credenciales confirmadas. No se excluyeron archivos de código por esta clasificación. |
| Diff | `git diff --check` aprobado. |

Comandos reproducibles, desde la raíz del repositorio, con Node 24.15:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd audit --json
npm.cmd run check
node --test --test-concurrency=1 tests/integration/code-audit.test.ts tests/integration/foundation.test.ts
npm.cmd run test:e2e
gitleaks git --redact --no-banner
```

El escaneo del árbol usó `gitleaks dir <copia-de-textos-versionados-y-nuevos> --redact`, sin bases comerciales, dependencias instaladas ni binarios. Cada coincidencia se contrastó con su línea fuente: exclusivamente entradas `ruta: SHA-256` en `docs/evidence/*/source-hashes.json` o `source-sha256.json`. Registros y clasificación redactada permanecen en `.local/code-audit/`. El primer intento E2E de la prueba añadida falló por `getByLabel` con coincidencia exacta en selectores anidados; se corrigió a la función y nombre accesible del combobox y el recorrido completo posterior pasó.

## Entrega y límites

Cambios locales revisables, sin commit/push/despliegue nuevo por esta revisión. Sitios ya configurados conservan su acceso; una base alojada nueva necesita una clave de instalación externa. Para publicar, seguir el procedimiento existente y no incluir secretos en comandos/logs/documentos.

Esta revisión no ensaya impresoras/cajones, pérdida física del perfil, restauración externa de Railway, WhatsApp ni migración histórica de Alegra. Sus pendientes documentados no se reclasifican como errores nuevos de esta auditoría. Las pruebas sintéticas no se presentan como operación comercial ni como prueba de la configuración/perímetro del servidor publicado.
