# Piloto local aislado

Estado: preparado; no es producción ni autoriza ventas reales. Decisión del usuario: conservar `.local/development` como evidencia/pruebas y usar una base separada para el piloto.

## Inicio

Desde el proyecto ejecutar `npm.cmd run start:pilot`. El sitio queda en `http://127.0.0.1:4410/` y la base aislada en `.local/pilot/`. El primer acceso solicita crear al dueño; no existe contraseña predeterminada. No copiar usuarios, turnos, ventas ni existencias desde desarrollo.

## Carga permitida

1. Crear usuarios y asignar Milán/Centro sin compartir contraseñas por chat o repositorio.
2. Cargar únicamente catálogo, recetas, conteos y costos revisados por Nativos.
3. Mantener impuestos vacíos cuando el contador no los haya definido; vacío no significa 0 % ni exento.
4. No importar historia de Alegra hasta recibir una extracción que cumpla `contracts/alegra-history-extract-v1.md`.
5. No registrar ventas reales hasta cerrar fiscalidad, respaldo externo y aceptación física de impresoras/cajones.

## Separación y recuperación

`.local/pilot` no debe reemplazar ni borrar `.local/development`. Los respaldos locales del piloto quedan en `.local/pilot-backups`, pero no cubren pérdida total del equipo. Antes de publicar se requiere el servicio administrado con PITR elegido en DEC-012 y sus parámetros operativos.
