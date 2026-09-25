# Plan — acceso a Caja

Migración 021 independiente del trabajo Excel 020: clave primaria compuesta `(device_id, installation_id)` en `pos_terminals`; acuses con instalación y unicidad por caja/instalación/secuencia. Rellenar la instalación histórica antes de permitir nuevas vinculaciones. Conservar triggers inmutables tras la migración transaccional. Turnos se asocian a su instalación al migrar y al abrir.

El token identifica una sola instalación. `/pos/enroll` inserta o renueva únicamente esa pareja; `/authorize` y `/sync` usan su cursor. Los acuses de otra instalación se rechazan. Las verificaciones de turno en payloads 1/2/3 incluyen instalación. La autorización comunica el turno central vigente y el cliente consulta antes de abrir online. La apertura offline mantiene el mecanismo existente de conciliación, sin prometer exclusión distribuida durante cortes de red.

El navegador permite cambiar con turno abierto, conserva perfiles y persiste el perfil de origen antes de intentar el destino. Los mensajes dejan de prometer una vinculación exclusiva. Pruebas: PostgreSQL con migración histórica, tokens simultáneos, secuencias independientes, idempotencia, permisos y turnos; E2E con dos contextos y cambio de sucursal con turno abierto, recarga y datos separados. Ejecutar checks y desplegar únicamente este checkout aislado.

## Continuación del turno

Migración aditiva 022: lista de instalaciones autorizadas a continuar en `pos_shifts`, sin cambiar la instalación original ni la unicidad por caja. Acción online autenticada y auditada `/api/pos/shift/resume`, idempotente por pertenencia y limitada al responsable original. Autorizar devuelve el responsable del turno abierto y proyecciones de los turnos compartidos accesibles: importes calculados desde los libros, comprobantes, devoluciones y movimientos sin costos.

El cliente incorpora las proyecciones solo sin outbox ni canje pendiente, mantiene sus pedidos y usa el saldo central como base de los cambios locales posteriores. Conserva cursores por instalación y no importa acuses ajenos. Sincroniza antes de un cierre compartido; cualquier conflicto de cierre conserva el pendiente. PostgreSQL serializa la incorporación, operaciones y cierre con el lock comercial existente. Ensayar dos contextos reales: base y venta previa, continuar sin segunda apertura, movimiento desde el segundo, pendiente offline del primero, reconexión, cierre y recarga. Probar permisos, rechazo de acuse ajeno, respuesta perdida e idempotencia.
