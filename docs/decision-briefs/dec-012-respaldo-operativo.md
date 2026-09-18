# DEC-012 — Decisión requerida: respaldo externo y recuperación operativa

Estado: propuesta; no autoriza contratar, publicar ni copiar datos comerciales fuera del entorno actual. Afecta REQ-011-04, AC-011-04/06, TASK-INC6-BKP-05 y TASK-INC8-05.

## Hechos ya establecidos

- El respaldo lógico local existente cubre únicamente hechos que el servidor ya recibió y puede restaurarse solo a una base aislada nueva.
- Cada local tiene un único computador. IndexedDB, pedidos y ventas sin acuse central pueden perderse ante pérdida total del equipo, perfil u origen; una copia en el mismo disco no los protege.
- Caja sincroniza mientras el sitio permanece abierto y conectado. No se promete sincronización ni respaldo con todas las pestañas cerradas.
- No hay volumen real, presupuesto mensual, proveedor, alojamiento, dominio, retención, RPO ni RTO aprobados.

## Decisiones que faltan

1. Ubicación y responsable del almacenamiento externo de la base sincronizada, con control de acceso y cifrado en tránsito/reposo.
2. Retención de copias y de registros de restauración; definir si hay retención legal/fiscal adicional.
3. RPO para datos sincronizados y RTO para restaurar el servidor en un entorno nuevo.
4. Presupuesto máximo mensual y responsable de revisar capacidad, fallos y restauraciones.
5. Procedimiento frente a pérdida del computador con operaciones offline: informar alcance, intentar recuperación del perfil solo si sobrevive y nunca declarar que un respaldo central las contiene.

## Alternativas de política

### A. Copias administradas diarias, sin recuperación a punto en el tiempo

El proveedor elegido conserva una copia diaria de PostgreSQL; se prueban restauraciones periódicas a un destino aislado. Es simple y de costo potencialmente menor, pero el RPO de datos sincronizados puede acercarse a 24 horas si la base falla antes de la siguiente copia.

### B. Copias administradas frecuentes más registro continuo

El proveedor conserva copias frecuentes y/o recuperación a punto en el tiempo, con retención definida. Reduce el RPO de datos sincronizados y facilita volver a un instante anterior, a cambio de mayor costo, operación y verificación de restauración.

### C. Operación propia con copias cifradas fuera del servidor

Nativos administra programación, cifrado, almacenamiento externo, alertas y pruebas de restauración. Da control sobre ubicación y retención, pero exige una persona responsable y capacidad operativa constante. No es adecuado si no existe ese responsable.

## Recomendación técnica inicial

Elegir **B** si el presupuesto permite un servicio administrado: reduce la ventana de pérdida de los datos ya sincronizados sin agregar operación propia. Si se elige A o C, documentar el RPO real y aceptar explícitamente su ventana de pérdida. Ninguna alternativa cubre pendientes exclusivos del navegador; esa limitación debe aparecer en pantalla, capacitación y procedimiento de incidente.

## Criterios de aceptación una vez aprobada

1. La política especifica ubicación/responsable, retención, presupuesto, RPO y RTO con unidades concretas.
2. Un respaldo creado en producción o ensayo autorizado se verifica sin exponer secretos ni contenido comercial en registros.
3. Una restauración a destino aislado comprueba esquema, conteos y hashes de los hechos sincronizados dentro del RTO acordado.
4. El procedimiento de pérdida total distingue explícitamente datos sincronizados de pendientes IndexedDB y no borra el perfil superviviente.
5. La alerta por fallo de copia o capacidad llega a un responsable definido y deja auditoría.

## Preguntas para resolver con la operación

- ¿Qué RPO máximo aceptan para los datos ya sincronizados: horas o un día?
- ¿Cuál es el RTO máximo aceptable para recuperar el servicio?
- ¿Cuántos días/meses/años deben conservarse copias y quién puede solicitar una restauración?
- ¿Qué presupuesto mensual y responsable operativo se aprueban?
- ¿Existe requisito de ubicación, tratamiento o conservación fiscal que condicione el proveedor?
