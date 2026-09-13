# Evidencia — Incremento 0

Fecha: 13-09-2026. Autorización: mensaje del usuario que inicia la construcción local con SDD. Alcance: primer incremento pendiente de docs/roadmap.md. Estado: completado en diseño, contratos y políticas de dominio; no equivale a completar 001/007.

## Punto de partida y cambio

Inspección con `rg --files`, lectura de agents.md, plan, README, SDD, arquitectura, decisiones, roadmap, matriz, specs 001/007 y plantillas. Solo existía documentación; no package.json, código ni repositorio Git. La maqueta HTML externa es referencia visual y no se reutilizó como backend. Se conservaron archivos fuente de negocio y reglas vigentes (impuesto opcional, impresoras asignadas).

Planes y tasks 001/007 y contratos Markdown escritos antes de implementar src/tests. DEC-001/003/004/015 registran decisiones rutinarias y límites. Se inicializó Git local sin remoto. No se instalaron servicios ni se accedió a Alegra.

## Verificación ejecutada

Entorno observado: Windows, Node v24.15.0, npm 12.0.2. Dependencias: Ajv 8.20.0, TypeScript 5.9.3, @types/node 24.13.4, fijadas con lockfile.

Comando: `npm.cmd run check` (desde la raíz del proyecto). Resultado: TypeScript estricto sin errores; **16 pruebas, 16 aprobadas, 0 fallos, 0 omitidas**. La instalación npm informó 0 vulnerabilidades conocidas en las 9 dependencias auditadas al ejecutarse; no equivale a auditoría de seguridad del producto.

Reproducir: `npm.cmd ci` y `npm.cmd run check`. Las pruebas usan identidades, importes y fechas sintéticos, sin introducir configuración real de negocio.

| Tarea / requisito | Escenarios y evidencia | Límite |
| --- | --- | --- |
| TASK-001-01/02; REQ-001-01/02/03 | authorization.test.ts: alcance por roles; altas/descuento/cancelación; compras del encargado; costos/puntos exclusivos; proyección cerrada; entradas inválidas | AC-001-01/02/03 parciales de dominio. No servidor/exportación/caché reales |
| TASK-001-01; REQ-001-04 | Contrato identity-v1.md describe identidad y auditoría transaccional | Auditoría solo diseñada |
| TASK-007-01/02; REQ-007-03/05 | authorization.test.ts: matriz offline; siete días exactos; retroceso de reloj; concesión ajena; permiso revocado; versión/duración inválida | AC-007-03/06 parciales. Sin firma ni custodia Windows |
| TASK-007-01/02; REQ-007-02/04 | sync.test.ts: respuesta perdida como estado puro; acuses repetidos/ajenos; conflicto; versión y orden mínimo | AC-007-02 parcial. No demuestra commit central, concurrencia ni reinicio |
| TASK-001-03/TASK-007-03; TASK-DOC-01 a 04 | Planes, contratos, matriz y este registro | Documentación del estado real |

## Pendientes explícitos

Incremento 1: usuarios/sucursales, login, servidor con permisos y auditoría persistida, UI accesible y pruebas API/UI. Antes de programarlo ampliar plan/tasks y OpenAPI.

Incremento 3: SQLite/PostgreSQL, payload de venta, transacciones, snapshots, secuencias persistidas, acuse por red, reintentos concurrentes, revocación/firma y reloj tras reinicio. La máquina pura de acuse NO implementa idempotencia central. No se hicieron ventas, impresión, exportaciones, envíos, migraciones ni restauraciones. No hay servicio desplegado. Hardware Milán T80A y Centro T82E USB 80 mm pendiente de prueba física. Impuesto vacío se conserva null en proyección; aceptación de venta sin impuesto se probará al implementar cobro.

## Identidad del código probado

SHA-256 de archivos ejecutables y dependencias comprobadas (permite verificar el resultado sin depender de un commit posterior de documentación):

| Archivo | SHA-256 |
| --- | --- |
| `contracts/identity-v1.schema.json` | `ff27eee30278b9b3d5e4abbc41923b4df99a22fa0a1d90b0080034448dd3cd47` |
| `contracts/offline-grant-v1.schema.json` | `f4115b78e87946fd95c3cb0af59cdd45453f3b5e00023d270dc86fba171e78fb` |
| `contracts/sync-v1.schema.json` | `7e1b4c6085bee72d3d7f296d2869e4650e862a434bc9e264b91eeb5018358ef7` |
| `package-lock.json` | `d11f1bf75f43e460c76e1972fda252b3b9c1d02cca0d73c7daee43ddd700abe4` |
| `package.json` | `7a023fe25dbfab1c5b2ca6dffaa831a6364fa2d68d7cdf28861a85889ab6ec2c` |
| `src/authorization.ts` | `2cc6d6c88d094f006f1629bd45aa0d33c1010dd9a17bb6e30b9f34eaf84c65f6` |
| `src/contracts.ts` | `077b1d93a61613eb311995ccedcf1b66107dfb4de8c9826c43e027f007a6e17b` |
| `src/sync.ts` | `0f638657fa7dafe2c278e8e491ea5dcaec5c67361decc8cdc43dd9eaa8de0bb2` |
| `tests/authorization.test.ts` | `c3f29c6399cbb7a1b60dcff6266494d7193b575552c977ab48ac09fafd042a48` |
| `tests/sync.test.ts` | `46f44a74192598f4d03322a7e1e39cd7ddcf2049d382408a9f1752ce8d234115` |
| `tsconfig.json` | `ad9d1f80f8be486bb9c33e35f0b701154b351a9d9bd996f36b5e730c6ff8156f` |
