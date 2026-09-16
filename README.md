# Nativos — Un solo sitio para Administración y Caja

Dirección confirmada por el usuario el 15-09-2026: Administración y Caja en el mismo sitio web, conservando hasta siete días de Caja sin internet y recuperación al cerrar/reabrir navegador. Se sustituye el requisito de aplicación Electron. La implementación anterior 0–5 se conserva como historia y compatibilidad; la transición web tiene [especificación propia](specs/012-unified-web/spec.md).

## Abrir el sitio local

Desde esta carpeta, en Windows con Node 24.15 o compatible con package.json:

```powershell
npm.cmd ci
npm.cmd run start:local
```

Abre [Nativos](http://127.0.0.1:4310/) y entra con tu usuario. **Caja y ventas** abre [Caja](http://127.0.0.1:4310/caja) en el mismo sitio y usa la sesión existente. El lanzador compila e inicia un servidor web local y PostgreSQL para desarrollo; ya no inicia Electron ni el servicio separado del puerto 4311. Estos procesos son el entorno de desarrollo, no una aplicación que deba instalarse en cada equipo cliente del sitio alojado.

No hay contraseña predeterminada. Si no existe configuración, el primer dueño elige sus credenciales. La base de desarrollo, usuarios y operaciones existentes se conservan en `.local/development`, fuera de Git. No borrar esa carpeta para corregir problemas. Alojamiento, dominio y publicación siguen pendientes de autorización/preparación operativa.

## Caja en el navegador

El dueño vincula una vez el navegador a Milán o Centro. Usa siempre el mismo origen y perfil de Edge/Chrome para esa caja. Las pestañas comparten instalación y datos; un bloqueo de escritura evita cobrar simultáneamente la misma revisión. Cada usuario conserva sus permisos y turno propio.

Caja guarda pedidos, turno, ventas, pagos, consumo, comprobantes, devoluciones y pendientes en IndexedDB. Una venta solo se muestra confirmada después del commit local. Los canjes necesitan confirmación central. El catálogo descargado conserva versiones y excluye costos incluso si antes entró un dueño.

Sin internet se puede vender, guardar pedidos, cancelar, emitir comandas internas, registrar propina, devolver con permiso y cerrar turno. Crear productos/clientes/recetas, administrar compras/configuración y canjear puntos requiere conexión. A los siete días se bloquean nuevos cobros/aperturas; consulta, pedidos y cierre siguen disponibles. Los puntos de compras offline quedan pendientes.

La primera carga y validación requieren conexión. El sitio precarga su interfaz para reabrirla offline. Cerrar todas las pestañas detiene la actividad de Caja; la sincronización se reanuda al abrirla y reconectar. No borrar datos del sitio ni cambiar de perfil/origen mientras existan pendientes: el servidor solo conserva lo sincronizado. Almacenamiento persistente no sustituye un respaldo ante pérdida del disco.

## Conservar la caja anterior

Los archivos `.local/pos/pos.sqlite` y `.local/pos/vault.dpapi` se mantienen. Si existe una caja anterior, un dueño que abre Caja desde un navegador sin vincular verá **Trasladar caja anterior**. El servicio antiguo debe estar detenido. El traslado conserva la instalación, secuencia, pedidos, turnos, comprobantes, devoluciones, pendientes e intención de canje; fija un solo destino y bloquea nuevas escrituras del motor anterior. No borra la fuente. Si la operación se interrumpe, reintentar desde el mismo perfil.

El adaptador `src/pos/` y los archivos `desktop/` son históricos para compatibilidad y pruebas. No continuar el desarrollo del producto en Electron. No copiar bases entre cajas ni forzar otra vinculación para resolver un conflicto. El puente de archivos solo se habilita en desarrollo; no existe como acceso a archivos del servidor alojado.

## Funciones conservadas

- Usuarios, sucursales, bodegas, permisos y auditoría.
- Productos terminados/preparados, precios e impuestos opcionales, recetas y opciones versionadas.
- Existencias iniciales, mínimos y reversiones; costos exclusivos del dueño.
- Pedidos de mostrador, mesa o domicilio manual; clientes, notas, descuentos, comandas y desperdicio al cancelar preparados.
- División por productos, medios combinados, cambio solo en efectivo, propina/domicilio separados y devoluciones autorizadas.
- Fidelización: inscripción, puntos, canje, comprobante, devoluciones, saldos negativos y ajustes/reglas auditados del dueño.

Los datos de las pruebas son sintéticos y viven en carpetas/bases separadas. No se importaron fuentes comerciales ni se modificó Alegra.

## Verificar cambios

```powershell
npm.cmd run check
npm.cmd run test:e2e
```

Check valida TypeScript, reglas de dominio, PostgreSQL real y regresiones de adaptadores históricos; compila el sitio y los esquemas precompilados. E2E usa Edge e IndexedDB reales, misma dirección para Administración/Caja, cierre/reapertura del navegador offline, pestañas concurrentes, canje con respuesta perdida y accesibilidad. No ejecutar dos suites E2E a la vez: comparten el puerto sintético 4320. Las pruebas anteriores de SQLite/Electron no acreditan por sí solas el nuevo adaptador.

## Guía de trabajo

1. [Plan funcional vigente](software-nativos.md) e [instrucciones](agents.md).
2. [Proceso SDD](docs/sdd.md), [trazabilidad](specs/README.md) y [decisiones](docs/decisions.md).
3. [Arquitectura web](docs/architecture.md), [contrato Caja web](contracts/browser-pos-v1.md) y [plan de transición](specs/012-unified-web/plan.md).
4. [Hoja de ruta](docs/roadmap.md).

Los planes históricos se conservan; para trabajo nuevo prevalece DEC-021. Antes del incremento 6 se verifica esta transición. Después: compras, traslados, conteos, informes, Excel, costeo promedio y respaldos. WhatsApp/API-MCP e importación/lanzamiento conservan su orden posterior.

Impresión física de 80 mm, cajones USB y fiscalidad siguen pendientes. Deben ensayarse desde navegador antes de operar; no prometer impresión silenciosa ni apertura de cajón por una prueba visual. No hay despliegue productivo, integración bancaria ni respaldo operativo terminado.
