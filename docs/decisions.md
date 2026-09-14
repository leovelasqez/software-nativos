# Decisiones y aclaraciones pendientes

Este registro distingue reglas ya acordadas de decisiones técnicas propuestas y preguntas abiertas. No invalida el trabajo independiente ni obliga a consultar todos los asuntos a la vez.

## Reglas confirmadas que no deben reabrirse por defecto

Dos sucursales, una caja por local; descuento de ingredientes al cobrar; inventario negativo con alerta; siete días offline; creación de productos/clientes/recetas online; descuentos y cancelaciones previas al cobro sin autorización; costos de recetas y márgenes solo dueño, con importes de compras accesibles al encargado de su local; canje de puntos online; paleta con `#00bf63`; reemplazo de Alegra; historial completo; puesta en marcha conjunta.

## Registro

| ID | Estado | Decisión o pregunta | Afecta / momento de resolución |
| --- | --- | --- | --- |
| DEC-001 | Aceptada técnicamente, incremento 0 | Servidor modular único, reglas de dominio compartidas y adaptadores separados; conservar el stack propuesto del plan. | Diseño inicial, antes de estructura productiva. |
| DEC-002 | Parcialmente resuelta | Confirmados: propina sobre productos después de descuentos, antes de canje y sin envío; total al peso más cercano con precisión interna. Impuestos opcionales por producto: permitir guardar y vender con campo vacío, sin calcular impuesto ni convertirlo en tasa 0% o exención. Se descarta el bloqueo propuesto. Pendientes: tasas cuando se asignen y distribución de impuestos/descuentos/redondeos. | Contratos de cálculo de ventas y caja. |
| DEC-003 | Diseño base definido; adaptadores pendientes | Al agotar siete días, bloquear nuevos cobros hasta reconectar; conservar consulta, pedidos y cierre de turno. Contrato base de orden, conflictos y reloj en 007; eventos tardíos/costeo, firma y persistencia por implementar. | Sincronización antes del primer flujo persistente de cobro. |
| DEC-004 | Separación de datos definida; integración pendiente | El encargado registra toda la compra de su local, incluidos precios e importe pagado, y consulta esos importes. No habilita márgenes ni costo de recetas. Separación central/caché definida en contrato 001; falta integración con almacenamiento/API. | Compras, permisos y costeo central/local. |
| DEC-005 | Pendiente de diseño | Costeo promedio con saldo negativo y entradas tardías: qué se estima, cuándo se reconcilia y qué historia se conserva. | Costos, movimientos y reportes. |
| DEC-006 | Negocio resuelto; diseño pendiente | Base final con impuestos, después de descuentos y canje; límite de canje antes del propio canje. Cobro dividido por cliente. Revertir puntos generados aunque haya saldo negativo y restituir puntos usados/dinero proporcionalmente a productos devueltos. Falta reparto exacto de puntos enteros y redondeos. | Ventas, fidelización y devolución. |
| DEC-007 | Pendiente de diseño | Coordinación del canje central con el cobro local ante pérdida de conexión: reserva, confirmación, liberación y reconciliación. | Canje online antes de habilitarlo. |
| DEC-008 | Entorno parcialmente confirmado | Milán: T80A, ESC/POS según etiqueta. Centro: NP / New Print T82E. Ambas USB de 80 mm y compartidas entre comprobantes/comandas en cada local. Faltan controladores, prueba del cajón e impresión, Windows concreto, firma y distribución del instalador. | Prueba de hardware y distribución. |
| DEC-009 | Pendiente externo | Documentos fiscales aplicables y sistema que los emitirá al abandonar Alegra. | Puesta en marcha real, no impide especificar comprobantes internos. |
| DEC-010 | Configuración inicial confirmada; entorno/diseño pendientes | Dueño y encargado del local: mínimos diarios a las 8:00 a. m. de Colombia, cierre inmediato tras sincronizar. Faltan números, emisor, plantillas, servicio, costo y tratamiento de entrega incierta. | Diseño final y activación de notificaciones. |
| DEC-011 | Pendiente de entorno | Acceso seguro y cobertura de tipos de documentos/historia en Alegra; mapeo entre sucursales, productos y clientes. | Migración y conciliación. |
| DEC-012 | Restricción confirmada; diseño pendiente | Solo computador por local, sin segundo dispositivo para respaldo offline; pérdida total del disco puede perder operaciones no sincronizadas. Volumen real desconocido: medir historial/piloto. Faltan presupuesto, alojamiento, dominio, crecimiento, retención y objetivos de pérdida/recuperación. | Dimensionamiento y operación antes de publicar. |
| DEC-013 | Negocio resuelto | El cajero indica unidades ya preparadas al cancelar o quitar productos enviados; esas unidades generan desperdicio y las restantes se cancelan sin consumo. No requiere aprobación. | Contrato de cantidades y auditoría pendiente de implementación. |
| DEC-014 | Negocio confirmado para división y cambio; diseño pendiente | Cliente y comprobante por cobro dividido. Cambio solo sobre efectivo, sin excedentes digitales convertidos en cambio. Falta distribución de redondeos y recuperación de pagos fallidos/devoluciones parciales. | Cálculo y contrato de cobro. |

## Aclaración SDD 1 — Respuestas incorporadas

Fuente: respuesta numerada del usuario a las seis preguntas de compras, propina, redondeo, cuentas divididas, devoluciones de puntos y cancelaciones. La respuesta 1 fue «el encargado registre todo»; 2, 3 y 6 aceptaron la propuesta, y 4 y 5 fueron afirmativas. Esto autoriza actualizar la especificación, no iniciar código productivo.

| Respuesta | Decisión incorporada | Trazabilidad |
| --- | --- | --- |
| 1 | Encargado registra compras completas de su local. La captura implica acceso a los importes de compra; costos de recetas/márgenes conservan su restricción. | DEC-004; REQ-001-02; REQ-003-02; AC-003-05 |
| 2 | Propina porcentual después de descuentos, antes de puntos y sin envío. | DEC-002; REQ-004-04; AC-004-06 |
| 3 | Total al peso más cercano, conservando precisión interna. | DEC-002; REQ-004-04; AC-004-09 |
| 4 | Cliente, comprobante y acumulación por cada cobro de una cuenta dividida. | DEC-006/014; REQ-004-04/06; AC-004-07 |
| 5 | Reversión de puntos generados incluso con saldo negativo; compras permitidas y canjes limitados al saldo disponible. | DEC-006; REQ-005-05; AC-005-06 |
| 6 | Cajero identifica unidades preparadas canceladas para desperdicio; las no preparadas no consumen. | DEC-013; REQ-004-03; AC-004-08 |

Consecuencia: la prohibición general de costos para encargado tiene una excepción limitada a compras. No ampliar esa excepción a otras sucursales, reportes de márgenes o al cajero. El flujo alternativo en el que el dueño debía completar cada compra queda descartado.

## Cómo cerrar una decisión

### Aclaración SDD 2 — Cinco respuestas afirmativas

Fuente: el usuario respondió «Si» a las cinco propuestas de base de puntos, restitución de pagos con puntos, cambio, expiración offline y WhatsApp. No implica autorización de implementación ni de envío real.

1. Precios finales con impuestos incluidos, menos descuentos y pagos con puntos para acumular; límite del 20% después de descuentos y antes del canje. DEC-006; AC-005-07.
2. Devolver proporcionalmente puntos usados y dinero efectivamente pagado, sin convertir puntos a efectivo; conservar reversión de puntos generados. DEC-006; AC-005-08.
3. Cambio solo sobre efectivo, sin excedentes digitales convertidos a efectivo. DEC-014; AC-004-10.
4. Agotados siete días offline, bloquear nuevos cobros y conservar consulta, pedidos y cierre de turno. DEC-003; AC-007-06.
5. Dueño y encargado reciben mínimos diariamente a las 8:00 a. m. de Colombia y cierre inmediato tras sincronizar. DEC-010; AC-009-05.

### Registro de decisiones posteriores

Agregar fecha, contexto, alternativas relevantes, decisión, motivo, consecuencias, requisitos afectados y evidencia de la instrucción o validación que la sustenta. Para decisiones técnicas rutinarias dentro del alcance autorizado, el agente puede proponer y resolver con pruebas y una justificación; no atribuir al usuario una aprobación que no dio.

No insertar respuestas ficticias para marcar una especificación «Lista». Si una decisión bloquea únicamente una parte del módulo, delimitar un incremento independiente y continuar con él dentro de la autorización existente.

## Aclaración SDD 3 — Catálogo y entorno, 13 de septiembre de 2026

Fuente: cuatro respuestas del usuario y las dos fotos de etiquetas de impresoras adjuntas. Registro histórico: los pendientes de impuesto y asignación/modelo de impresoras descritos aquí quedan sustituidos por la aclaración SDD 4.

1. Los impuestos se asignarán a cada producto después de crearlo. Se especifica guardado con impuestos pendientes, sin asumir cero. Propuesta aún sin aprobar: impedir venta hasta configurar impuesto o indicar explícitamente sin impuesto. DEC-002; REQ-002-02; AC-002-05.
2. Volumen diario y de hora pico desconocido. No exigir estimaciones inventadas; medir historial/piloto y separar objetivos sintéticos de observaciones reales. DEC-012.
3. Ambas impresoras USB; etiquetas de 80 mm. T80A declara ESC/POS; segunda NP / New Print con modelo exacto por confirmar. No hay prueba de controladores ni conexión real. Faltan sucursal de cada unidad y uso para comandas. DEC-008; REQ-011-04.
4. Solo computador del local. Sincronización y respaldo central solo cubren operaciones recibidas; copia local en el mismo disco no sobrevive su pérdida total. Diseñar restauración con esa limitación explícita. DEC-012; REQ-007-06; AC-011-06.

Estas respuestas actualizan documentos; no autorizan implementación productiva, compra de equipos ni contratación de servicios.

## Aclaración SDD 4 — Impresoras y campo opcional de impuestos

Fuente: el usuario confirma Milán/T80A y Centro/T82E, ambas para comprobantes y comandas, y responde «Con posibilidad de dejar la casilla en blanco» a la propuesta de bloqueo por impuesto pendiente. Las nuevas fotos muestran T82E en Foto 1 y T80A en Foto 2.

- DEC-008: modelos, sucursales y uso compartido resueltos; compatibilidad física aún sin probar. REQ-011-04; AC-011-07.
- DEC-002: se interpreta la respuesta como campo opcional también para vender; se retira el bloqueo propuesto. Vacío significa sin impuesto asignado y sin cálculo de impuesto, no tasa 0% ni declaración de exención. REQ-002-02; AC-002-05; AC-004-11. Se conserva la definición fiscal externa pendiente de DEC-009.
- Cambios de impuesto solo afectan ventas nuevas; conservar estado e importes históricos en consulta, reimpresión y sincronización. No se inicia implementación productiva.

## DEC-015 — Autorización y diseño del incremento 0 (13-09-2026)

El usuario autoriza implementación local y sustituye las restricciones históricas de inicio. No autoriza publicar, contratar ni modificar Alegra. Se ejecuta primero incremento 0; 001/007 completos no se declaran verificados. No hay código previo ni Git: inicializar repositorio local sin remoto para trazabilidad.

DEC-001 aceptada técnicamente: monolito modular y dominio TypeScript; conservar React/Electron/SQLite/PostgreSQL para adaptadores posteriores. Evita introducir infraestructura antes de probar reglas. Núcleo Node 24.15.0 (entorno observado), Ajv 8.20.0 para esquemas 2020-12, TypeScript 5.9.3 para comprobación estricta. Lockfile fija dependencias. Fuentes: [Node TypeScript](https://nodejs.org/api/typescript.html) y [JSON Schema 2020-12](https://json-schema.org/draft/2020-12).

DEC-003: concesión por actor/equipo/local con vencimiento máximo de siete días; restricciones y máximo temporal según contrato 007. Entrega al menos una vez e idempotencia central transaccional, orden por equipo; solo acuse coincidente marca sincronizado. Firma/DPAPI, transporte y persistencia permanecen pendientes. No se afirma resistencia a manipulación física del equipo.

DEC-004: costeo central, sin costos en caché POS, proyecciones por lista permitida y compras online separadas con excepción del encargado en su local. Alternativa descartada: descargar costos y ocultarlos en UI, porque expone el archivo local. Probar frontera de dominio ahora, API/caché/exportaciones en incrementos que los implementan.

REQ-001-01/02/03/04 y REQ-007-02/03/04/05; planes 001/007 y futura evidencia del incremento 0. DEC-002/014 de cálculo no bloquean envolturas: antes del incremento 3 se completa payload y reparto. Las tasas no se inventan; impuesto vacío conserva null y no bloquea venta. Milán T80A y Centro T82E USB 80 mm se conservan para pruebas físicas posteriores.

## DEC-016 — Fundamentos locales (incremento 1)

Autorización: «Ok, continua con incremento 1». Fastify + pg + React/Vite conservan el stack. PostgreSQL no está instalado; usar binarios reales mediante embedded-postgres solo como helper de desarrollo/pruebas, sin servicio Windows ni Docker. Base persistente .local/ excluida, contraseña aleatoria protegida con DPAPI en Windows; pruebas aisladas. Servidor vinculado a loopback, sin publicación. Dependencias exactas en lockfile.

Sesiones opacas con cookie HttpOnly/SameSite Strict, 12 horas, hashes de sesión y scrypt asíncrono para contraseña. Bootstrap por formulario del primer dueño, sin contraseña predeterminada. Bloqueo transaccional de bootstrap/administración, defensa contra CSRF/origen/Host, revocación por cambios. Dueño administra identidades y organización; usuarios se limitan a sucursales explícitas. La firma de concesiones POS y su custodia siguen en incremento 3, no se habilita administración web offline.

Migraciones SQL con checksum/advisory lock, auditoría append-only y mismo commit; índices únicos para una caja activa y bodega de venta por local. No datos comerciales inventados. AC-001-02/03 comerciales siguen pendientes de catálogo/ventas. REQ-001-01/02/04/05 y AC-001-01/04/05 a 10; ver plan 001 y contrato foundation-v1.

Fuentes técnicas consultadas: [Fastify validación](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [Node crypto](https://nodejs.org/api/crypto.html), [Vite](https://vite.dev/guide/) y [embedded-postgres](https://github.com/leinelissen/embedded-postgres). Límites de sesión/intentos son decisiones de seguridad técnicas, no tasas ni datos de negocio.
