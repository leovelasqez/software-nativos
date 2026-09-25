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
| DEC-005 | Resuelta por el usuario, 17-09-2026 | Alternativa A: una salida sin costo fiable conserva costo desconocido; ninguna entrada tardía reescribe historia. El dueño realiza una conciliación causal y motivada. Cero nunca sustituye costo desconocido. | Costos, movimientos y reportes. |
| DEC-006 | Verificada localmente; DEC-020 | Base final con impuestos, después de descuentos y canje; límite de canje antes del propio canje. Cobro dividido por cliente. Revertir puntos generados aunque haya saldo negativo y restituir puntos usados/dinero proporcionalmente a productos devueltos. Reparto acumulado proporcional y redondeos definidos en loyalty-v1. | Ventas, fidelización y devolución. |
| DEC-007 | Verificada localmente; DEC-020 | Confirmación central atómica, intención local durable y recuperación/cancelación serializada ante pérdida de conexión. | Canje online antes de habilitarlo. |
| DEC-008 | Diferida para piloto posterior | Milán: T80A; Centro: T82E; ambas USB 80 mm. El 17-09-2026 el usuario indicó que no hay operador/hardware disponible para aceptación física; el lanzamiento real permanece bloqueado hasta ejecutar el protocolo. | Prueba de hardware y distribución. |
| DEC-009 | Descartada por el dueño, 18-09-2026 | No se requiere confirmación del contador, procedimiento con Alegra, numeración, contingencia ni integración fiscal para operar esta versión. Caja emite comprobantes internos; la fiscalidad externa queda fuera de alcance y no bloquea el lanzamiento. | Sin dependencia operativa. |
| DEC-010 | Adaptador real desactivado | Se conservan cola, simulación y observabilidad local; el usuario decidió no activar WhatsApp real para cerrar el MVP. No se requieren números ni proveedor hasta un incremento posterior autorizado. | Integración externa posterior. |
| DEC-011 | Migración histórica diferida | El MVP se cierra sin historia de Alegra porque no existe exportación completa. Se conserva contrato y puerta de importación; no se inventan datos ni se modifica Alegra. | Migración posterior. |
| DEC-012 | Railway desplegado; cierre de recuperación pendiente | El usuario eligió Railway el 18-09-2026. El sitio y PostgreSQL privado quedaron desplegados y saludables, con PITR habilitado y almacenamiento conectado. Antes de operar faltan restauración aislada, presupuesto, responsable, RPO, RTO y retención; ninguna copia central cubre pendientes exclusivos de IndexedDB. | Evidencia `docs/evidence/railway-deployment-2026-09-18.md`; cierre de GO-04 pendiente. |
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
- DEC-002: se interpreta la respuesta como campo opcional también para vender; se retira el bloqueo propuesto. Vacío significa sin impuesto asignado y sin cálculo de impuesto, no tasa 0% ni declaración de exención. REQ-002-02; AC-002-05; AC-004-11. DEC-009 fue descartada y no añade una dependencia fiscal externa.
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

## DEC-017 — Catálogo y existencias iniciales (incremento 2)

Implementación local autorizada y reiterada el 14-09-2026. Se conserva el stack y lockfile del incremento 1, sin dependencias nuevas. Contratos 002/003 completados antes de código. Cantidades/dinero viajan como strings decimales; dominio BigInt a seis decimales, persistencia numeric(30,6), rechazo de multiplicaciones que exijan mayor precisión. Unidad comercial: unidad por presentación, terminado enlazado a artículo del mismo ID. Materias primas y consumibles usan g/ml/unit. Conversiones métricas g/kg y ml/l; cualquier otra requiere factor y fuente suministrados. Borradores conservan conversiones parciales y cantidades pendientes, sin habilitar venta.

Versiones inmutables de productos/recetas; control optimista al editar producto o publicar receta. Un borrador no reemplaza la última receta activa. Consumos base y opciones quedan congelados; dominio de consumo previsto compartido con la futura caja, sin cobros ni descuento real por venta aún.

Inicial único vigente por artículo/bodega, con cantidad/costo inicial opcional y conversión de entrada trazada. Reversión relacionada y nueva entrada para corrección, sin borrar movimientos. Saldo derivado y mínimos. Dueño y encargado según inventory.manage; costo inicial solo owner + cost.write, consultas de costos solo owner + cost.read. Proyecciones públicas y auditoría omiten valores de costo; el movimiento protegido conserva su valor histórico. Costos de receta solo base, por bodega; desconocidos quedan pendientes. Costeo promedio, negativos por venta y entradas tardías siguen sujetos a DEC-005/incremento 6, sin estimaciones nuevas.

Cada mutación revalida identidad dentro del lock 7301, comparte transacción con auditoría y respuesta idempotente. La misma clave/actor/ruta/payload devuelve su respuesta; conflicto recibe 409. Clientes mantienen clave al reintentar la misma solicitud en el formulario abierto; el cierre/reapertura no constituye persistencia offline. Sin cliente POS publicado.

Recuperación verificada mediante reinicio PostgreSQL y exportación/importación SQL de un snapshot lógico de datos sintéticos a una segunda base recién migrada. El runtime empaquetado no trae pg_dump: no se presenta este fixture de pruebas como herramienta de respaldo operativo, ni como protección ante pérdida del disco. Respaldo/restauración operativa permanece en incremento 6.

## DEC-018 — Primera venta y caja local (incremento 3)

Autorización: «Continua con el incremento 3», 14-09-2026. Se concreta el redondeo de DEC-002/014: cálculo interno a seis decimales, total al peso más cercano con empate hacia arriba, ajuste de redondeo explícito; impuestos asignados incluidos en precio, división racional redondeada a seis decimales. No se inventan tasas. Cuenta completa y un pago; reparto por devoluciones/división se difiere a 4. Consumidor final, sin puntos.

Electron 44.3.0 consultado en npm; seguridad según https://www.electronjs.org/docs/latest/tutorial/security. Servicio Node 24 con SQLite nativo (https://nodejs.org/api/sqlite.html), proceso distinto del central, custodio DPAPI Windows. No requiere librería SQLite nativa compilada. Electron usa renderer aislado/sandbox y abre únicamente la URL local de caja, sin API general privilegiada. Instalador/Node empaquetado y firma de distribución se reservan a lanzamiento; ejecución local reproducible con runtime existente.

Tokens/grants/verificadores/reloj local cifrados DPAPI; clave privada Ed25519 exclusivamente central. Una instalación activa por caja; no reasignar desde la UI silenciosamente. Cola histórica transmitida por equipo aunque usuario revocado, con revisión central explícita y sin autorización para nuevas ventas. Cadena de secuencias y snapshot verificable impiden reescribir precios/consumos en sincronización. Sin prometer protección contra administrador del equipo/disco.


## DEC-019 — Pedidos y división (incremento 4)

Decisión técnica bajo autorización local: máquina de estados compartida, eventos de payload v2, migraciones aditivas, descuentos a seis decimales y reparto por mayores restos al peso de componentes del cobro. El residuo de descuento fijo permanece en el pedido pendiente; selección repetida no se cobra dos veces. Propina/envío separados y cada cobro tiene cliente propio. No se extiende todavía fidelización. Tratamiento de devolución de propina/envío consultado al usuario; resto del alcance continúa.

Respuesta del usuario, 14-09-2026: «Permitir devolver también propina y domicilio». Se habilitan importes seleccionables acotados por el componente pagado y devoluciones anteriores.


Complemento técnico DEC-019: la devolución local usa sale.refund en una concesión firmada vigente y turno propio; no se permite tras expiración. Se registra de forma causal después del cobro, con saldo acumulado y sin modificar el comprobante. El resumen del turno separa propina/domicilio efectivamente pagados y sus devoluciones, incluyendo todos sus movimientos. Consulta de historia de cliente por sucursal y solo datos sincronizados, paginados.


## DEC-020 — Fidelización y canje confirmado centralmente

Diseño de DEC-006/007 concretado en contracts/loyalty-v1.md y planes increment-5 antes de implementar. Regla inicial confirmada se conserva. Reparto proporcional acumulado de puntos enteros con empate arriba; dinero por paidAmount tras canje, sin convertir puntos a dinero. Intención durable local y commit central de venta+puntos como alternativa a reserva con vencimiento; recuperación idempotente y cancelación con tombstone serializado. Sin pérdida de pendientes ni devolución automática de puntos ante respuesta incierta. La interfaz muestra esta recuperación.

## DEC-021 — Sitio web único (15-09-2026)

Usuario sustituye Administración web + Caja Electron por un sitio web y confirma siete días offline. Nueva dirección: React/PWA, IndexedDB, Web Locks y Web Crypto; servidor modular PostgreSQL existente. El cliente no requiere Node, SQLite ni Electron instalados. La instalación PWA es opcional. La evidencia 0–5 describe la arquitectura anterior; preservar contratos/datos y verificar nuevos adaptadores antes de declararlos equivalentes. Ver specs/012-unified-web. Impresión/cajón y recuperación deben validarse en navegador; no prometer sincronización con todas las pestañas cerradas.

## DEC-022 — Caja accesible desde varios navegadores (24-09-2026)

El usuario solicita abrir Centro y Milán sin restricción de navegador. Sustituye la instalación exclusiva de DEC-018 y el bloqueo de cambio con turno abierto de spec 015. Cada pareja caja/instalación conserva token y cadena causal propia; los acuses antiguos se asocian a su instalación sin cambiar su contenido. Se conserva un turno activo por caja y la titularidad del navegador que lo abrió. Cambiar de sucursal archiva el perfil completo y permite volver a su turno. No se copian datos locales entre navegadores ni se descartan pendientes. Ver spec 018.

### Ampliación de DEC-022 — Continuar turno (25-09-2026)

El usuario elige continuar el mismo turno desde otro computador. La titularidad comercial sigue siendo del usuario responsable; deja de ser exclusiva del navegador original. Una acción online explícita habilita la instalación adicional en ese turno. Migración 022 agrega miembros al registro existente, sin cambiar IDs, base, tokens o cursores ni crear otra apertura. La proyección central de ventas, devoluciones y movimientos se aplica en IndexedDB solamente después de confirmar la cola propia. Los pendientes y pedidos locales de otra instalación permanecen allí; deben sincronizarse antes del cierre. El cierre compartido requiere conexión y converge por autorización/sincronización; operaciones tardías rechazadas permanecen para conciliación. Contrato y evidencia: spec 018, AC-018-05/06/07.
