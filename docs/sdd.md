# Proceso de Spec Driven Development

## Propósito

Implementar cada capacidad a partir de comportamientos verificables, conservando su relación con el alcance, los contratos, las decisiones y las pruebas. SDD se usará durante todo el mantenimiento, no solo para producir documentación al comienzo.

Este es el proceso específico del proyecto; no depende de una herramienta o framework comercial.

## Jerarquía documental

1. Instrucciones vigentes del usuario y restricciones de seguridad del entorno.
2. `software-nativos.md`: alcance de negocio y reglas acordadas.
3. `specs/NNN-*/spec.md`: requisitos y aceptación por capacidad.
4. Decisiones aceptadas y `plan.md`: diseño técnico para cumplir esos requisitos.
5. Contratos, `tasks.md`, código y evidencia.

Una capa inferior no redefine silenciosamente una superior. La maqueta guía la apariencia y los flujos; sus números, atajos y simulaciones no reemplazan las reglas del producto.

## Estados

| Estado | Qué significa |
| --- | --- |
| Borrador | Requisitos derivados del plan, con preguntas o diseño pendientes. |
| Lista para implementar | Criterios de aceptación, dependencias, contratos y tareas definidos; decisiones bloqueantes resueltas. |
| En implementación | Existe autorización para el alcance y tareas en ejecución. |
| Verificada | Implementación y pruebas del alcance completadas con evidencia reproducible. |
| Publicada | Desplegada en el entorno acordado, con validación operativa. |

La autorización para implementar se registra por separado con su mensaje o referencia verificable. Ni «Lista» ni «Verificada» otorgan autorización para contratar, publicar o operar cuentas externas.

## Ciclo por capacidad

1. **Especificar:** actores, flujo principal, permisos, estados, datos, errores, reglas offline, exclusiones y escenarios Dado/Cuando/Entonces.
2. **Aclarar:** resolver preguntas que cambian el negocio o bloquean contratos. Registrar otras preguntas para el incremento correspondiente. Reutilizar decisiones ya tomadas.
3. **Diseñar:** responsabilidades, interfaces, consistencia, efectos atómicos, migraciones y estrategias de recuperación. Registrar alternativas y motivos cuando la decisión sea material.
4. **Planificar:** tareas limitadas, con requisitos y escenarios asociados y una definición concreta de terminado.
5. **Implementar:** cambios pequeños, dentro del alcance autorizado. Añadir pruebas de comportamiento junto con el cambio; usar ejemplos de aceptación como datos de prueba, no como configuración real.
6. **Verificar:** pruebas automatizadas apropiadas y comprobaciones operativas que requieren equipos o servicios reales. Registrar resultados y límites.
7. **Mantener:** actualizar especificaciones y contratos junto al código; conservar identificadores de requisitos al modificarlos y documentar sustituciones.

## Identificadores y trazabilidad

- Requisito: `REQ-004-01`.
- Escenario de aceptación: `AC-004-01`.
- Tarea: `TASK-004-01`.
- Decisión: `DEC-001`.

Cada tarea referencia requisitos y escenarios. Las pruebas usan esos identificadores en nombres o metadatos. No renumerar registros existentes para acomodar nuevos: agregar identificadores y marcar los reemplazados.

La matriz inicial cubre grupos funcionales del plan. No acredita cobertura ejecutada; esta se completa con enlaces a contratos, pruebas y evidencia a medida que exista código.

## Condiciones para empezar un incremento

- Alcance implementable definido y autorizado, sin necesidad de volver a pedir aprobación para tareas ya cubiertas.
- Requisitos y escenarios identificados.
- Decisiones de negocio bloqueantes cerradas; dependencias satisfechas o delimitadas mediante contratos verificables.
- Contratos de API, datos, eventos y permisos definidos para las interfaces que realmente cambian.
- Tareas concretas y estrategia de prueba, migración y recuperación acordes al impacto.
- Ausencia de cifras inventadas: límites de rendimiento, almacenamiento y recuperación deben declararse como propuestas hasta validarse.

## Condiciones para terminar

- Los escenarios acordados pasan en el nivel apropiado: dominio, integración, contrato y extremo a extremo.
- Permisos comprobados desde API y almacenamiento expuesto, no solo mediante ocultación visual.
- Operaciones sensibles a duplicados probadas con repetición y fallos parciales.
- Cambios de datos con migraciones revisadas y estrategia de recuperación probada.
- Contratos y documentación reflejan el código entregado; no quedan comportamientos relevantes implementados sin especificación.
- Evidencia identificable: comandos, versión o cambio evaluado, resultados y asuntos no verificados.
- Para interfaces, revisión de teclado, tamaño móvil y ambos temas; para hardware, comprobación en los equipos concretos.
- Para publicación, respaldo, conciliación y observabilidad operativa comprobados en el entorno objetivo.

## Gestión de cambios

Antes de alterar una regla, identificar módulos afectados. Actualizar la especificación, las decisiones necesarias, contratos, tareas y pruebas en el mismo cambio. Si una diferencia encontrada es un error respecto de la especificación vigente, corregir la implementación y agregar una prueba de regresión; no cambiar la especificación para justificar el error.

Las correcciones rutinarias dentro de una autorización vigente no requieren una nueva aprobación general. Los cambios de negocio no resueltos se consultan con el usuario antes de ejecutar la parte dependiente.

## Calidad transversal

- Componentes y módulos con responsabilidades explícitas y dependencias controladas.
- Datos personales y secretos limitados a lo necesario; registros sin credenciales ni volcados indiscriminados de clientes.
- Identificadores de operación para seguimiento, conciliación e idempotencia.
- Métricas operativas propuestas: edad/cantidad de pendientes de sincronización, errores de envío, resultados de respaldos y errores de operación. Umbrales por definir en el diseño correspondiente.
- Pruebas de respaldo y restauración, no solo existencia de archivos.
- Sin prometer entrega exactamente una vez de mensajes externos si el proveedor no permite demostrarla; reconciliar estados inciertos antes de reintentar.
