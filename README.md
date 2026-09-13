# Nativos — Desarrollo guiado por especificaciones

## Estado actual

Implementación local autorizada el 13-09-2026. Incremento 0 completado: diseño base, contratos versionados y núcleo TypeScript de permisos, concesión offline y validación de acuses. Ver [evidencia y trazabilidad](docs/evidence/increment-0.md). No existe todavía aplicación operativa ni despliegue de producción.

001/007 tienen verificado únicamente el alcance del incremento 0; los módulos completos permanecen pendientes. La maqueta externa es referencia visual y no ejecuta funciones del sistema. No se han leído ni modificado datos de Alegra ni archivos fuente Excel/Word.

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

Los planes y tareas de 001/007 delimitan el incremento 0. `contracts/` contiene esquemas compartidos, `src/` políticas de dominio y `tests/` pruebas sintéticas. Los demás incrementos requieren completar sus propios planes antes del código.

## Cómo se realiza un cambio

Ejemplo: agregar una sustitución de leche a una venta.

1. Identificar los requisitos de catálogo, ventas e inventario afectados.
2. Especificar la selección, su precio, la versión de receta y los ingredientes que se consumen.
3. Resolver cómo se conserva esa selección offline y en el comprobante.
4. Definir contratos y tareas pequeñas con pruebas esperadas.
5. Implementar dentro del alcance autorizado.
6. Ejecutar las pruebas y registrar resultados, incluidos reintentos y reconexión.

Una pantalla que permite seleccionar una leche no demuestra por sí sola que el inventario, el costo y la sincronización funcionan.

## Verificación local

Requiere Node 24.15.0 o posterior de la rama 24; npm y dependencias fijadas en package-lock.json. Desde esta carpeta:

```powershell
npm.cmd ci
npm.cmd run check
```

`check` ejecuta TypeScript estricto y las pruebas de dominio/contratos. No inicia servidor, no crea usuarios ni conecta servicios. La política recibe identidades y concesiones ya autenticadas por un adaptador futuro: no es un sistema de login. No existe todavía comando para abrir una caja o facturar.

## Próximo paso

Incremento 1 — Fundamentos: refinar plan/tasks y contrato OpenAPI antes de implementar usuarios/sucursales persistentes, autenticación, permisos en servidor, auditoría y shell React accesible claro/oscuro. Reutilizar las políticas verificadas y probarlas desde API; completar firma/custodia de concesiones conforme al alcance elegido. No requiere renovar la autorización local existente.
