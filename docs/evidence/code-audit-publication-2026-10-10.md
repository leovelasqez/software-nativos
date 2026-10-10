# Publicación de la revisión integral — 10-10-2026

El usuario pidió publicar en Railway los cambios de la [revisión integral del código](code-audit-2026-10-09.md). El commit funcional `3d90b4e4d986c2a45538ec8c1812d64b00af4c2a` se envió a `origin/main` y se desplegó en el proyecto `nativos`, servicio `nativos-web`, entorno `production`.

- Despliegue Railway: `b285958c-5127-43aa-93f0-f47d53e1d307`; estado `SUCCESS`.
- Origen público: <https://nativos-web-production.up.railway.app>.
- `/health`: HTTP 200, `{"ok":true}`. `/api/status`: `setupRequired=false`.
- Las doce rutas de la compilación verificada respondieron HTTP 200 y coincidieron por SHA-256 con el build local. Para `/theme.js` se normalizaron los finales de línea CRLF/LF antes de comparar el contenido.
- La compilación de Railway informó cero vulnerabilidades conocidas en `npm audit`.

El paquete de despliegue se preparó desde ese commit, con 163 archivos necesarios para la aplicación. Se excluyeron evidencia histórica, Excel sintéticos versionados y dos Excel comerciales locales no versionados. La comprobación en producción fue de solo lectura: no se operaron turnos, inventario ni datos de clientes.

[Resultados verificables por ruta y hash](code-audit-deployment-2026-10-10.json).
