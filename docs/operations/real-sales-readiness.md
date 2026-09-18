# Puerta de habilitación de ventas reales

Estado: bloqueada por validaciones externas. Este documento organiza el cierre operativo; no crea credenciales, no contrata servicios, no modifica Alegra y no autoriza publicar ni cobrar.

## Alcance habilitable

Cuando todas las puertas estén aprobadas y el dueño autorice expresamente la puesta en marcha, se podrá programar el cambio conjunto de Milán y Centro. Hasta entonces, el piloto aislado solo admite datos y ensayos autorizados.

La migración histórica de Alegra y la activación de WhatsApp real están **diferidas**. No son puertas para este lanzamiento y no deben iniciarse, simularse como completadas ni bloquear el cierre de las puertas listadas abajo.

## Puertas obligatorias

| ID | Puerta | Evidencia de aprobación | Responsable de completarla | Estado |
| --- | --- | --- | --- | --- |
| GO-01 | Credenciales del dueño creadas en la base de piloto | Inicio de sesión exitoso del dueño, sin registrar la contraseña ni secretos en evidencia | Dueño | Completada el 17-09-2026 |
| GO-02 | Prueba representativa de inventario y costos | Un producto y un insumo probados correctamente en el piloto; carga restante progresiva sin inventar datos | Dueño | Completada el 18-09-2026 |
| GO-03 | Fiscalidad externa | No aplica a esta versión | — | Descartada por el dueño el 18-09-2026; no es puerta operativa |
| GO-04 | Railway y respaldo PITR operativo | Railway desplegado; presupuesto, responsable, RPO, RTO y retención aprobados; PITR habilitado y restauración aislada ensayada dentro del RTO | Dueño / responsable operativo | En curso: despliegue saludable y PITR habilitado el 18-09-2026; faltan parámetros y restauración |
| GO-05 | Hardware aceptado en ambos locales | Protocolo `hardware-acceptance.md` ejecutado con T80A en Milán, T82E en Centro y los dos cajones; anomalías resueltas o aceptadas explícitamente | Responsable presencial por local | Pendiente |
| GO-06 | Autorización de puesta en marcha | Mensaje expreso del dueño posterior a GO-01…GO-05, con fecha/ventana de cambio conjunta | Dueño | Pendiente |

## Criterios de cierre por puerta

### GO-01 — dueño del piloto

En `http://127.0.0.1:4410/`, crear el primer dueño directamente en el formulario de inicio. La contraseña se elige allí y no se comparte por chat, archivos, capturas ni repositorio. Confirmar solo la creación y el acceso exitoso.

### GO-02 — inventario y costos

Para el piloto, el dueño aprobó como suficiente una prueba correcta con un producto y un insumo. El inventario y los costos restantes pueden cargarse progresivamente después de iniciar la operación, siempre con datos revisados. La ausencia de costo queda como `desconocido`, nunca como cero implícito; no se inventan cantidades, costos ni conversiones.

### GO-03 — descartada

El dueño decidió el 18-09-2026 que la confirmación del contador y el procedimiento fiscal con Alegra no son necesarios para operar esta versión. GO-03 no bloquea ventas reales ni la autorización de lanzamiento. Caja conserva comprobantes internos y la fiscalidad externa queda fuera de alcance.

### GO-04 — PITR y recuperación

Railway ya aloja el sitio y PostgreSQL, y PITR está habilitado con almacenamiento conectado. Falta anotar valores concretos de RPO, RTO y retención, además de presupuesto y responsable de alertas/restauraciones. La sesión CLI debe reautenticarse antes de crear la copia manual y ejecutar la prueba, que restaura a un destino aislado y nunca sustituye la base activa. Las ventas que solo viven en IndexedDB antes del acuse central no quedan cubiertas ante pérdida total del equipo.

### GO-05 — impresoras y cajones

Ejecutar todos los casos de `hardware-acceptance.md` en el navegador y perfil reales: T80A de Milán y T82E de Centro imprimen comprobantes y comandas de 80 mm; ambos cajones se prueban por separado. No repetir cobros reales para diagnosticar impresión. La evidencia no debe contener datos personales ni credenciales.

### GO-06 — cambio conjunto

Después de comprobar GO-01, GO-02, GO-04 y GO-05, el dueño debe autorizar expresamente una fecha y ventana para el cambio de ambos locales. GO-03 no aplica. Esa autorización es independiente de la autorización previa de implementación local y de cualquier prueba de piloto.

## Registro de cierre

| Puerta | Fecha/hora America/Bogota | Evidencia o referencia | Validó | Resultado / observaciones |
| --- | --- | --- | --- | --- |
| GO-01 |  |  |  |  |
| GO-02 | 18-09-2026 | `docs/evidence/go-02-pilot-validation-2026-09-18.md` | Dueño | Completada: prueba correcta con un producto y un insumo. La carga completa queda como trabajo progresivo, no como puerta. La plantilla del 17-09 continúa disponible como referencia. |
| GO-03 | 18-09-2026 | Instrucción expresa del dueño | Dueño | Descartada; no es puerta operativa ni de lanzamiento. |
| GO-04 | 18-09-2026 | `docs/evidence/railway-deployment-2026-09-18.md` | Verificación técnica | Parcial: web/PostgreSQL saludables y PITR habilitado; restauración, parámetros y responsable pendientes. |
| GO-05 |  |  |  |  |
| GO-06 |  |  |  |  |
