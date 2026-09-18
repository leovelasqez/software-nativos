# Piloto local aislado

Estado: preparado; no es producción ni autoriza ventas reales. Decisión del usuario: conservar `.local/development` como evidencia/pruebas y usar una base separada para el piloto.

## Inicio

Desde el proyecto ejecutar `npm.cmd run start:pilot`. El sitio queda en `http://127.0.0.1:4410/` y la base aislada en `.local/pilot/`. El primer acceso solicita crear al dueño; no existe contraseña predeterminada. No copiar usuarios, turnos, ventas ni existencias desde desarrollo.

## Carga permitida

1. Crear usuarios y asignar Milán/Centro sin compartir contraseñas por chat o repositorio.
2. Cargar progresivamente catálogo, recetas, cantidades y costos revisados por Nativos. GO-02 ya fue validada con una prueba representativa; no es necesario completar todo el inventario antes de operar el piloto.
3. Los impuestos pueden permanecer vacíos; vacío no significa 0 % ni exento y no bloquea la venta.
4. No importar historia de Alegra hasta recibir una extracción que cumpla `contracts/alegra-history-extract-v1.md`.
5. No registrar ventas reales hasta completar las cinco puertas activas de [habilitación de ventas reales](./real-sales-readiness.md): dueño del piloto, conteos/costos, PITR, hardware y autorización expresa de puesta en marcha. GO-03 fue descartada y no aplica.

## Separación y recuperación

`.local/pilot` no debe reemplazar ni borrar `.local/development`. Los respaldos locales del piloto quedan en `.local/pilot-backups`, pero no cubren pérdida total del equipo. Antes de publicar se requiere el servicio administrado con PITR elegido en DEC-012 y sus parámetros operativos. La migración histórica de Alegra y WhatsApp real permanecen diferidos y no se ejecutan como parte de este piloto.
