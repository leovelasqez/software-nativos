# 011 — Migración y puesta en marcha

Estado: Borrador. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, secciones 14–17.

## Requisitos

- REQ-011-01: importar catálogo desde el maestro y contrastar formulaciones; resolver conversiones y datos activos sin alterar los originales.
- REQ-011-02: recuperar todo el historial de ventas disponible en Alegra desde el primer registro; preservar identificadores, estados y datos disponibles y conciliar documentos/totales.
- REQ-011-03: historia de consulta sin descontar existencias iniciales, afectar turnos nuevos ni generar puntos; inventario y costos iniciales cargados progresivamente con datos revisados. La prueba representativa aprobada para GO-02 es suficiente para iniciar el piloto.
- REQ-011-04: probar hardware, recuperación de respaldos, esquema local y procedimientos operativos; definir qué datos no sincronizados no están cubiertos por respaldo central.
- REQ-011-05: ensayar y lanzar conjuntamente Milán/Centro después de validación y preparación operativa; no incluir funciones excluidas en el plan por inferencia. DEC-009/GO-03 no aplican.
- REQ-011-06: desplegar el sitio único en Railway con PostgreSQL privado, origen HTTPS único, variables externas sin secretos en el repositorio, escucha en el puerto asignado y comprobación de salud contra la base. El sistema alojado no usa PostgreSQL embebido ni guarda respaldos en el disco efímero del contenedor.

## Fronteras

Extracción de solo lectura → archivo/área de preparación → mapeo y validación → importación repetible → conciliación → corte operativo. Registrar filas/documentos sin mapear y ausencias históricas; no inventar costos ni sucursales.

Definir una fecha de corte y actualización final para evitar omitir ventas realizadas en Alegra entre una extracción inicial y el cambio. El procedimiento de recuperación debe conservar lo nuevo si se requiere corregir una importación o volver temporalmente al sistema anterior.

## Aceptación

- AC-011-01 → REQ-011-01. Dada una conversión no resuelta en el maestro, cuando se importa, entonces se reporta y no se activa una receta incorrecta.
- AC-011-02 → REQ-011-02/03. Dado un historial importado y conciliado, cuando se repite la importación, entonces se conservan documentos únicos y no varían inventario inicial, turnos nuevos ni puntos.
- AC-011-03 → REQ-011-02. Dada una extracción con documentos posteriores a la primera carga, cuando se ejecuta el corte final, entonces la conciliación cubre todo el período sin omisiones ni duplicados.
- AC-011-04 → REQ-011-04. Dado un respaldo y operaciones locales pendientes, cuando se ensaya una restauración, entonces se demuestra qué datos se recuperan, qué pendientes sobreviven y los límites reales del procedimiento.
- AC-011-05 → REQ-011-05. Dadas las pruebas de ambos locales y pendientes de puesta en marcha resueltos, cuando se autoriza el cambio, entonces se ejecuta el procedimiento conjunto y se registra la validación de ventas/caja/inventario posterior.
- AC-011-08 → REQ-011-06. Dado un servicio Railway con `DATABASE_URL`, dominio público y `PORT`, cuando arranca, entonces aplica migraciones de forma idempotente, sirve Administración/Caja en el mismo origen HTTPS y `/health` responde correctamente solo si PostgreSQL está disponible. Si falta una variable requerida, el proceso falla sin imprimir credenciales.

## Dependencias y pendientes

Todas las capacidades que integren la primera versión; DEC-008/011/012. No marcar hardware, entrega de mensajes o recuperación como verificados por pruebas de maqueta. DEC-009 fue descartada y la fiscalidad externa no es una dependencia. Evidencia: pendiente.

## Entorno confirmado y validación pendiente

Asignación confirmada por el usuario y nuevas fotos aportadas el 13 de septiembre de 2026 (sustituyen la identificación provisional anterior):

- Milán: T80A, papel de 80 mm, USB y ESC/POS indicados en la etiqueta (nueva Foto 2); marca no identificada.
- Centro: NP / New Print T82E, USB y 80 mm (nueva Foto 1). No inferir soporte ESC/POS de esta unidad.
- Cada local usa su misma impresora para comprobantes y comandas.
- Pendientes: controladores, prueba de impresión y apertura del cajón.
- Cada local tiene solo su computador, sin respaldo offline en otro dispositivo. El volumen diario y de hora pico no está disponible; obtener mediciones del historial y piloto antes de cerrar el dimensionamiento.

AC-011-06 → REQ-011-04. Dada una pérdida total simulada del almacenamiento local, cuando se ensaya recuperación desde el servidor, entonces se concilian las operaciones previamente sincronizadas y se documenta que las operaciones exclusivamente locales no están cubiertas. Una copia en el mismo disco no se contabiliza como recuperación frente a este fallo. No realizar esta prueba destruyendo datos reales.

- AC-011-07 → REQ-011-04. Dadas la T80A USB de Milán y la T82E USB de Centro, cuando se ensayan comprobantes y comandas online y offline en cada local, entonces ambos documentos se dirigen a la misma impresora de ese local, con formato de 80 mm. Una falla de impresión no repite cobros; la comanda no descuenta inventario. Registrar evidencia por equipo y probar la apertura del cajón por separado.

## Dirección vigente — sitio web único

La revisión del 15-09-2026 conserva estas reglas y sustituye el cliente de escritorio por módulos del mismo sitio web. Aplicar DEC-021 y [012](../012-unified-web/spec.md). Pruebas históricas de Electron/SQLite no sustituyen aceptación en navegador. Impresión, cajón y recuperación del perfil se verifican antes de operar; no exigir instalador de escritorio.

## Incremento 6 — alcance preparado

Se diseña respaldo lógico y restauración aislada de datos ya sincronizados, sin migrar Alegra ni tocar datos comerciales. La política de retención, ubicación externa, RPO y RTO sigue bloqueada por DEC-012. Ver `plan.md`, `tasks.md` y `../../contracts/backup-v1.md`.

## Incremento 8 — plan de ejecución preparado

La migración, prueba física y lanzamiento requieren fuentes, decisiones y autorización externas. El flujo, sus puertas y límites están en `plan-increment-8.md`; las tareas trazadas están en `tasks-increment-8.md`. Ninguno de los dos documentos acredita una importación, una prueba física ni un lanzamiento.

## Puerta vigente de ventas reales

La habilitación queda bloqueada hasta completar y registrar las puertas activas en [la lista operativa](../../docs/operations/real-sales-readiness.md): GO-01 credenciales del dueño en piloto y GO-02 prueba representativa de inventario/costos ya están completadas; en GO-04 Railway y PITR ya están operativos, pero faltan restauración aislada, presupuesto, responsable, RPO, RTO y retención; permanecen además GO-05 aceptación física de T80A/T82E/cajones y GO-06 autorización expresa posterior. GO-03 fue descartada y no aplica. La carga completa del inventario, la migración histórica de Alegra y WhatsApp real están diferidas y no son condiciones de este lanzamiento.
