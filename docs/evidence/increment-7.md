# Evidencia — Incremento 7 local

Fecha de verificación: 17-09-2026. Alcance: API/MCP para agentes (7A) y cola local de notificaciones (7B). No acredita publicación, WhatsApp Business, entrega de mensajes, costo promedio ni operación externa.

## 7A — API y MCP de agentes

- Credenciales opacas con hash, rotación y revocación: `migrations/012-agent-credentials.sql`, `src/server/security.ts` y `tests/integration/agent-api.test.ts`.
- Consultas acotadas a sucursal de productos, recetas, existencias, movimientos e informes sin costos; importaciones de inventario y catálogo/recetas atómicas e idempotentes: migraciones 013/014 y `src/server/agent-api.ts`.
- MCP JSON-RPC expone sólo herramientas declaradas que delegan a las rutas autorizadas. La integración cubre lectura permitida y escritura rechazada para el agente de sólo lectura.
- Contratos: `contracts/agent-api-v1.json`, `contracts/agent-import-v1.schema.json`, `contracts/agent-catalog-import-v1.md`.

## 7B — Cola local de notificaciones

- `migrations/015-notification-intents.sql` conserva intenciones deduplicadas, intentos append-only y operaciones de simulación idempotentes.
- `src/server/notifications-api.ts` materializa mínimos diarios en la ventana de las 08:00 Colombia y cierres confirmados. La clave persistente impide duplicados en reinicios/pasadas repetidas; una reposición previa al corte queda fuera de la nueva evaluación.
- La pantalla de dueño `web/Notifications.tsx` muestra estado por sucursal y ofrece únicamente simulación local. Un cajero recibe 403 por API y no ve el módulo.
- No se almacenan teléfonos, plantillas, tokens de proveedor ni URLs de entrega; estados inciertos no se reintentan automáticamente.

## Comandos observados

```powershell
npm.cmd run typecheck
node --test --test-reporter=tap tests/integration/agent-api.test.ts
node --test --test-reporter=tap tests/integration/cash.test.ts
node --test --test-reporter=tap tests/integration/reports.test.ts
npm.cmd run build
git diff --check
npm.cmd run test:integration
npm.cmd run test:e2e
```

Los comandos anteriores terminaron sin fallos en los alcances indicados. El 17-09-2026, tras incorporar ciclo de vida de catálogo y conciliación causal de costos, `npm run test:integration` concluyó serialmente con 57 pruebas aprobadas, 0 fallos, en 466.384 s. A continuación, sin concurrencia con esa suite, `npm run test:e2e` concluyó con 1 recorrido integrado aprobado en Edge (3,0 min). Se revisó además que la actualización del service worker se descargue con red disponible mientras una venta permanece pendiente, y que el reinicio offline conserve el comprobante. Esta evidencia usa bases, perfiles y datos sintéticos aislados.

## Límites retenidos

- DEC-005: resuelta con alternativa A y spec 014. No se calcula margen histórico retroactivo; los costos desconocidos continúan pendientes hasta conciliación causal del dueño.
- DEC-010/012: emisor, destinatarios reales, plantillas, proveedor, reintentos de entrega, retención y operación de WhatsApp no están configurados.
- Hardware, Alegra en los alcances aún autorizados, despliegue y recuperación operativa necesitan sus verificaciones externas respectivas. Nota posterior del 18-09-2026: DEC-009/GO-03 fueron descartadas y la fiscalidad externa no es una verificación ni puerta de esta versión.
