# Plan — Sitio web único
Estado: verificado localmente en el alcance de la transición; ver docs/evidence/unified-web.md. REQ-012-01 a 05; usuario confirma conservar offline.

React conserva componentes de Administración/Caja bajo un origen. Caja cambia transporte HTTP local por adaptador navegador. Dominio exacto reutilizado. IndexedDB guarda un agregado versionado en transacción readwrite con durabilidad strict; Web Locks serializa lectura, validación, cómputo y commit entre pestañas. Fallo de almacenamiento no muestra cobro confirmado. Service worker precachea únicamente shell/activos públicos, nunca API o costos; navegación offline permite entrar en Caja. No forzar actualizaciones mientras haya clientes abiertos.

Web Crypto verifica Ed25519 central; contraseña offline con PBKDF2 y sal aleatoria, sesión limitada. Concesiones históricas y terminal permanecen locales; CSP estricta y validadores precompilados sin eval. No equiparar custodia del navegador con DPAPI. Regla siete días/reloj/permisos compartida. Canje central conserva intención durable y protocolo v3 existente. API web usa cookie HttpOnly única; token de instalación separado para sincronización.

PostgreSQL y API comercial conservados; SQL 001–005 no se editan. Adaptadores SQLite/DPAPI anteriores permanecen para migración y regresión; no se atribuye su verificación al navegador. Transferencia requiere comprobar instalación, secuencia, ausencia de otra caja activa y preservar fuente. Excel/compras quedan después de estabilizar transición.

Pruebas: dominio/regresión API existente, E2E navegador con IndexedDB real, cierre/reapertura offline, pestañas concurrentes, recuperación de canje, permisos, accesibilidad y no cacheo de API. Evidencia propia. Datos sintéticos separados. Hardware y producción permanecen pendientes.

## Mantenimiento de cursor y conciliación

La autorización central incluye el `serverOperationId` asociado a `serverSequence`. Un perfil local sin outbox adopta ambos antes de generar comandos; nunca reduce su cursor si el servidor está atrasado. Una colisión ya persistida permanece visible como `reconciliation_required`, bloquea nuevas escrituras y no se presenta como una simple falta de red.

La recuperación requiere una acción explícita del operador. Tras obtener y verificar un cursor central reciente, reasigna secuencia y predecesor de la cola local completa, sin cambiar `operationId`, payload, hash, concesión ni efectos locales. Los comprobantes locales afectados adoptan la numeración causal nueva antes del reenvío. El servidor vuelve a validar revisiones, turnos, permisos e importes; cualquier conflicto comercial posterior permanece para conciliación y ningún pendiente se descarta sin acuse coincidente.

## Recuperación de rechazos antiguos de inventario

REQ-003-03 permite que el consumo de una venta deje existencias negativas. Una venta que haya quedado bloqueada por un rechazo anterior y específico de existencias insuficientes puede reintentarse mediante una acción explícita, sin reencadenar ni modificar su envoltura. El motor reconoce únicamente operaciones de cobro con el código histórico `insufficient_stock`/`stock_insufficient` o el mensaje histórico exacto, las devuelve a `retry` y las envía por el protocolo idempotente normal. Cualquier nuevo rechazo vuelve a `reconciliation_required`; no hay descarte ni bucle automático.
