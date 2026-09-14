# Nativos — Desarrollo guiado por especificaciones

## Estado actual

Implementación local autorizada. **Incrementos 0 y 1 completados en su alcance**: políticas compartidas, administración React, servidor Fastify y PostgreSQL real con usuarios, permisos por sucursal y auditoría. Ver [evidencia del incremento 1](docs/evidence/increment-1.md).

La aplicación local permite configurar el primer dueño, iniciar/cerrar sesión, crear/editar usuarios y permisos, administrar sucursales/bodegas/equipos y consultar auditoría. No hay cobros, catálogo, caja offline ni sincronización comercial implementados. No está desplegada en producción ni conectada a Alegra. La maqueta externa permanece como referencia visual; esta interfaz tiene servidor y persistencia reales.

## Lectura inicial

1. [Plan de producto](./software-nativos.md): qué necesita Nativos y qué queda fuera.
2. [Instrucciones para agentes](./agents.md): restricciones y forma de trabajo.
3. [Proceso SDD](./docs/sdd.md): cómo convertir una necesidad en una entrega verificada.
4. [Índice y trazabilidad](./specs/README.md): especificaciones que cubren el plan.
5. [Arquitectura propuesta](./docs/architecture.md): límites, datos e integraciones.
6. [Decisiones pendientes](./docs/decisions.md): asuntos que no deben resolverse por suposición.
7. [Secuencia de entrega](./docs/roadmap.md): incrementos y dependencias.

## Organización

```text
software-nativos.md          Alcance funcional consolidado
agents.md                   Instrucciones para agentes
docs/
  sdd.md                    Proceso, estados y criterios de calidad
  architecture.md           Arquitectura y responsabilidades
  decisions.md              Registro de decisiones y preguntas abiertas
  roadmap.md                Orden de trabajo y criterios de salida
specs/
  README.md                 Matriz de trazabilidad y estados
  _templates/               Plantillas de spec, plan y tareas
  001-foundation/spec.md     Identidad, sucursales, permisos y UI
  002-catalog-recipes/spec.md
  003-inventory-purchases/spec.md
  004-sales/spec.md
  005-customers-loyalty/spec.md
  006-cash/spec.md
  007-offline-sync/spec.md
  008-reports/spec.md
  009-whatsapp/spec.md
  010-agent-api/spec.md
  011-migration-release/spec.md
```

El plan y tareas de 001 incluyen los incrementos 0/1; 007 conserva su frontera offline. `src/server/` contiene API/persistencia, `web/` la interfaz, `migrations/` el esquema SQL, `contracts/` los contratos y `tests/` las pruebas. Los siguientes incrementos requieren completar sus propios planes antes del código.

## Cómo se realiza un cambio

Ejemplo: agregar una sustitución de leche a una venta.

1. Identificar los requisitos de catálogo, ventas e inventario afectados.
2. Especificar la selección, su precio, la versión de receta y los ingredientes que se consumen.
3. Resolver cómo se conserva esa selección offline y en el comprobante.
4. Definir contratos y tareas pequeñas con pruebas esperadas.
5. Implementar dentro del alcance autorizado.
6. Ejecutar las pruebas y registrar resultados, incluidos reintentos y reconexión.

Una pantalla que permite seleccionar una leche no demuestra por sí sola que el inventario, el costo y la sincronización funcionan.

## Ejecutar la aplicación local

Entorno verificado: Windows x64, Node 24.15.0, npm 12.0.2. Desde esta carpeta:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir [Nativos local](http://127.0.0.1:4310). La primera pantalla permite elegir nombre, usuario y contraseña del dueño (mínimo 12 caracteres). No existe una contraseña predeterminada. Milán/Centro y sus bodegas/cajas iniciales ya están registradas; no se crean usuarios ni operaciones comerciales de ejemplo.

`dev` compila React y arranca servidor/BD exclusivamente en 127.0.0.1 (puertos 4310 y 54329). PostgreSQL utiliza binarios del paquete fijado; no requiere servicio Windows, Docker ni contratación. No ejecutar dos instancias `dev` al mismo tiempo. Detener con Ctrl+C en la terminal de arranque; el proceso conserva los datos. Si esta tarea dejó la aplicación abierta, usar el enlace existente en vez de iniciar otra instancia.

Datos en `.local/development/`, fuera de Git. Credencial de BD protegida por DPAPI y permisos del usuario Windows; no copiarla ni pegarla en mensajes. Cambiar de usuario Windows puede impedir descifrarla. No borrar esa carpeta para solucionar un problema de acceso: contiene la base persistente. Recuperación de contraseña del dueño por autoservicio y puesta en producción no forman parte de este incremento; otro dueño autorizado puede cambiar la contraseña desde Usuarios.

## Verificación

```powershell
npm.cmd run check
npm.cmd run test:e2e
```

`check` verifica TypeScript, ejecuta 16 pruebas de dominio, una suite con 11 escenarios de integración contra PostgreSQL real y compila la interfaz. `test:e2e` usa Microsoft Edge instalado, levanta el servidor 4320 y una base sintética independiente, verifica el flujo completo y accesibilidad, y cierra su PostgreSQL al terminar. Requiere haber ejecutado build/check. No ejecutar varias suites E2E simultáneas: comparten el puerto de pruebas y su archivo temporal de control.

Pruebas y capturas usan identidades sintéticas y contraseñas efímeras generadas en memoria. Los directorios de pruebas `.local/test-*`/`.local/e2e-*` son independientes de desarrollo; no contienen datos operativos. Los diagnósticos locales no se versionan. La instancia de desarrollo y su configuración inicial no se alteran por las pruebas.

## Alcance y límites

- Servidor comprueba identidad, alcance y permisos; cambios de usuario revocan sus sesiones. Sesión web de 12 horas, distinta de los siete días offline futuros.
- Administración de usuarios, organización y auditoría reservada al dueño con permiso de configuración; otros usuarios consultan sus locales.
- Auditoría y mutaciones comparten commit. PostgreSQL impide update/delete/truncate de auditoría por las rutas normales probadas; no se promete resistencia frente al administrador del motor.
- Milán T80A y Centro T82E USB de 80 mm conservadas en configuración. No se probó hardware ni se imprimió.
- Impuesto opcional y reglas comerciales siguen vigentes; se implementan en catálogo/ventas. API de fundamentos no simula esas operaciones.
- Los datos persisten tras reiniciar procesos. Todavía no hay respaldo/restauración operativa ni protección ante pérdida total del disco.
- No habilitar acceso LAN/producción sin completar preparación operativa, HTTPS, credenciales de servicio y autorización de publicación.

## Próximo paso

Incremento 2 — Catálogo y existencias: refinar especificaciones 002/003, completar planes/tareas/contratos, implementar productos terminados/preparados, recetas válidas, movimientos iniciales y trazabilidad. No requiere renovar la autorización local.
