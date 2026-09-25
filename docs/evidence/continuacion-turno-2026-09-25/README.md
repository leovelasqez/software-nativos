# Continuación del mismo turno desde otro computador

Solicitud del usuario: corregir el bloqueo «hay otro navegador con caja abierta». Elige la opción 1, continuar el mismo turno. Trazabilidad: REQ/AC-018-05/06/07; ampliación de DEC-022.

## Resultado funcional

Con el mismo usuario responsable y la misma caja seleccionada, `Caja → Turno → Continuar este turno` recupera el turno confirmado: misma apertura, base y responsable. Cada instalación conserva sus credenciales y secuencias. Las ventas, devoluciones, propina, domicilio y movimientos confirmados se incorporan por identificador. Los pedidos locales y la cola propia se conservan; una proyección no sobrescribe cambios pendientes.

Continuar requiere conexión. Antes de cerrar, sincronizar todos los equipos que hayan operado el turno. Los datos que nunca salieron de un navegador solo permanecen allí. Si llega una operación después del cierre, se conserva para conciliación y no altera silenciosamente el cierre confirmado.

## Evidencia de servidor y navegador

- TypeScript y compilación de producción sin errores.
- 56 pruebas unitarias y 66 de integración aprobadas.
- Prueba específica de migración, tokens, cursores, continuación, permisos y pendientes: 5 pruebas aprobadas. Incluye reintento del mismo movimiento, una sola auditoría de continuación y rechazo tardío sin avanzar cursor.
- Respaldo y restauración: prueba adicional con lista de instalaciones de continuación no vacía; contenido restaurado idéntico.
- Suite E2E principal aprobada con dos contextos Edge independientes y PostgreSQL sintético. Los flujos generales de Administración/Caja, offline, canje y recuperación siguen funcionando.

| Paso en los dos navegadores | Resultado comprobado |
| --- | --- |
| A abre Centro con base 100 y Milán con 200 | Perfiles y turnos independientes por sucursal |
| A registra offline una venta de productos 13.000 + propina 1.000 + domicilio 2.000 | Venta y comprobante permanecen en A |
| B continúa Centro mientras A sigue offline | Misma base 100; no segunda apertura ni pérdida del pendiente |
| B registra ingreso 50; A recupera conexión y sincroniza | Ambos convergen a efectivo 16.150 y un comprobante |
| B cobra otra venta con los mismos importes; ambos sincronizan y recargan | Efectivo 32.150; propina neta 2.000 y domicilio neto 4.000; dos comprobantes |
| B devuelve la venta cobrada por A, incluyendo propina y domicilio | Efectivo 16.150; propina 1.000 y domicilio 2.000 |
| A corrige el ingreso de 50 registrado por B | Contrapartida trazable; efectivo 16.100 |
| B cierra contando 16.100; A sincroniza | Turno cerrado en ambos; diferencia cero y dos comprobantes conservados |
| A vuelve a Milán y cierra contando 200 | Turno de la otra sucursal intacto |

Las operaciones anteriores son sintéticas locales. No se abrieron, cerraron ni cobraron turnos comerciales para validar esta corrección.

## Publicación

Commit funcional `f7f6e1df3e23a3b5b86b8012408672e65ba840b5`, enviado a `origin/main`. Railway, servicio `nativos-web`, entorno `production`: despliegue `2aee9834-8f58-4590-bc17-306340b2fd0f` en estado `SUCCESS`.

Verificación del 25-09-2026 19:17 UTC: `/health` devuelve 200 y `{"ok":true}`; `/caja` devuelve 200 y referencia la entrada compilada verificada. Los cuatro archivos JavaScript publicados coinciden por SHA-256 con la compilación probada. Detalle en [deployment.json](deployment.json). La comprobación funcional con dos usuarios de navegador se hizo con datos sintéticos; la comprobación en producción se limita a disponibilidad y versión, sin modificar turnos comerciales.

Capturas revisadas: escritorio y móvil, tema claro/oscuro, botón de continuación visible sin desbordamiento horizontal. Última ejecución de la suite principal: `1 passed (2.2m)`.
