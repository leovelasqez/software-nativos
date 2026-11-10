# Evidencia — máquinas de estados, 09-11-2026

Alcance: spec 021, árbol `software-nativos` sobre `131a5b6` más el diff local de este incremento. Las demás ramas/worktrees se preservan. Autorización: solicitud del usuario de encontrar máquinas implícitas y mejorar UX, DX y AX sin romper la aplicación.

## Entregables

- [Mapa legible](../state-machines.md) y [JSON](../state-machines.json): 42 familias, 75 archivos fuente y 46 archivos de pruebas referenciados. Las familias agrupan instancias y regiones; una referencia a pruebas no equivale a cobertura completa del grafo.
- Controlador de operación única en memoria con bloqueo antes de yield y estado discriminado, consumido por `SaveForm` y la importación. No sustituye `operationId`/fingerprint ni cambia persistencia.
- Unión de estados de importación: editar/preview/completado; refresco fallido conserva lote/ID y sólo reintenta consulta. El padre propaga el error de consulta al diálogo.
- Dominio puro de notificaciones compartido por adaptación HTTP/webhook, API y etiquetas UI. Un callback de fallo definitivo impide que un HTTP tardío vuelva a poner el intento en cola de reintento.
- Comando de auditoría integrado en `check`; spec, diseño, tareas, contrato y documentación alineados.

## Verificación

| Comando / comprobación | Resultado |
| --- | --- |
| `node scripts/audit-state-machines.ts --json` | Correcto: 42 familias; IDs, estados, transiciones y referencias válidos |
| `npm run typecheck` | Correcto: TypeScript de servidor/pruebas y navegador |
| `npm test` dentro de `check` | 84 pruebas aprobadas |
| `npm run test:integration` dentro de `check` | 92 pruebas aprobadas, cero fallos en la ejecución conjunta final |
| `npm run build` | Correcto dentro de `check` final, después del ajuste visual |
| `npm run check` final | Código de salida 0: auditoría, tipos, 84 unitarias, 92 de integración y build |
| `npm run test:e2e` y repetición del caso nuevo | Cuatro recorridos Edge verificados: tres en la suite completa y el nuevo en repetición dirigida |
| `git diff --check` | Sin errores de whitespace |

Los logs locales de este entorno están en `.local/state-machines-final-check.log`, `.local/state-machines-check.log`, `.local/state-machines-e2e.log`, `.local/state-machines-e2e-retry.log` y `.local/state-machines-notifications-retry.log`; no se incluyen bases, credenciales ni perfiles de navegador en Git.

La primera suite E2E pasó los tres recorridos existentes; el nuevo llegó a completar la recuperación de importación y falló por buscar la etiqueta móvil `Cobrar` en escritorio. Se corrigió el selector a `Cobrar pedido`, se separaron visualmente las acciones de recuperación y se repitieron tipos, build y ese recorrido: aprobado. Capturas inspeccionadas en móvil/escritorio y ambos temas; axe sin infracciones en las cuatro combinaciones.

La primera ejecución conjunta de `check` pasó 84 pruebas unitarias y 84 de integración, pero el proceso del archivo de notificaciones terminó con el mensaje genérico `test failed` sin aserción detallada. La repetición aislada pasó las ocho pruebas de ese archivo, incluida la carrera nueva. La ejecución final de `check`, sin otra suite simultánea, pasó las 92 pruebas de integración y terminó con código 0. La causa de la interrupción inicial no quedó aislada; no se ocultó ni se deshabilitó ninguna prueba.

## Casos nuevos

- AC-021-02: doble envío en el mismo turno JS y durante solicitud retenida, conservación de campos tras error, reintento, excepción síncrona y rechazo no Error. Un cobro sin vendedor no activa el handler deshabilitado.
- AC-021-03: editar motivo invalida preview; confirmar inserta el lote una vez; error simulado de refresco conserva resultado/ID; recuperación por teclado consulta sin otra confirmación.
- AC-021-04: matriz de respuestas/callbacks repetidos o desordenados; callback firmado de fallo antes de una respuesta HTTP transitoria conserva `failed_terminal`, sin siguiente intento.
- E2E revisa escritorio 1440×1000, móvil 390×844, claro/oscuro, teclado, foco y axe. Capturas nuevas en `test-results/state-machines/`.

La revisión visual final inspeccionó las cuatro capturas. Las acciones de actualizar/cerrar tienen separación y se apilan en móvil; resultado confirmado, ID y fallo de consulta permanecen legibles. Los PNG históricos regenerados por las suites de agentes/WhatsApp se restauraron a su versión previa; no forman parte del cambio de este incremento.

## Límites

El inventario es una revisión estática y mantenible, no una demostración matemática de ausencia de otros estados. Se conservan y documentan guardas distribuidas de Caja y algunos diálogos/consultas; no se reescriben por uniformidad.

La validación usa PostgreSQL y navegadores sintéticos locales. No modifica Alegra ni datos comerciales, no envía WhatsApp real y no publica en Railway. Sin migraciones ni cambios de IndexedDB, protocolo de sync o concesiones. Impresión física, cajón y recuperación ante pérdida de disco conservan sus comprobaciones operativas pendientes.
