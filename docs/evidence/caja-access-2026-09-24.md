# Acceso a Centro y Milán — 24-09-2026

Solicitud: corregir el bloqueo `already_enrolled` y permitir que el dueño abra ambas cajas sin exclusividad de navegador. Implementación en un checkout separado del trabajo de importación Excel.

## Cambio

- La migración 021 conserva instalaciones anteriores, tokens, cursores, acuses y turnos. Añade identidad de instalación a los acuses y turnos históricos; no cambia ventas, comprobantes, importes ni inventario.
- Se aceptan varias instalaciones por caja. Cada token autentica su cadena causal; los reintentos propios son idempotentes y otra instalación no recibe ese acuse.
- El selector permite cambiar de sucursal con turno abierto y recuperarlo al volver. Un destino que falla conserva el perfil de origen.
- Antes de abrir un turno, el navegador consulta si la caja ya tiene uno. Informa si está en otro navegador y no genera una apertura local rechazada en ese caso. El servidor sigue imponiendo un solo turno por caja.

## Verificación local

- `npm run check`: TypeScript, 50 pruebas unitarias, 63 pruebas de integración y build correctos.
- `npm run test:e2e`: recorrido completo en Edge con IndexedDB real, incluido `caja-access-flow.ts`, correcto.
- Integración nueva: migración desde esquema anterior con acuse/turno existente, repetibilidad, protección append-only, acceso con token anterior, secuencia 1 de tres perfiles, idempotencia, rechazo de acuse/turno ajeno, Centro y Milán con turnos independientes y permisos de dueño/cajero.
- Navegador: dos contextos activan ambas cajas; cambia con turnos abiertos, recarga conservando base/turno, rechaza apertura conocida en otro navegador sin dejar outbox y conserva el perfil si falla la activación del destino. Captura revisada en `test-results/caja-access/open-centro.png`.
- Regresión completa: administración, catálogo, ventas, devolución, puntos, recuperación offline, canje con respuesta perdida, secuencia en conflicto, concurrencia de pestañas, temas y accesibilidad.

## Límites

Pedidos y operaciones locales no se copian entre navegadores. Los pendientes anteriores siguen en el navegador de origen y conservan su token para sincronizar. Un turno de otro navegador se cierra allí; la autorización de este cambio no implica cerrar turnos ni registrar ventas reales. Aperturas simultáneas durante carreras/cortes de red pueden requerir conciliación; la unicidad central nunca se elimina.

Despliegue: pendiente de verificar en Railway.
